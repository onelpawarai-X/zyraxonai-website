import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.RUNNER_PORT || 8787);
const ROOT = path.resolve(process.env.WORKSPACE_ROOT || '/workspace');
const ARTIFACTS = path.join(ROOT, '.artifacts');
const SESSION_SECRET = process.env.RUNNER_SESSION_SECRET || '';
const MAX_BODY = 512 * 1024;
const DEFAULT_TIMEOUT = 120_000;

await mkdir(ARTIFACTS, { recursive: true });

function safePath(input = '.') {
  const resolved = path.resolve(ROOT, String(input));
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) throw new Error('Path escapes workspace');
  return resolved;
}

function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function auth(req) {
  if (!SESSION_SECRET) return true;
  return req.headers.authorization === `Bearer ${SESSION_SECRET}`;
}

const TOOLS = {
  node_version: { bin: 'node', args: ['--version'], validate: args => args.length === 0 },
  powershell_version: { bin: 'pwsh', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], validate: args => args.length === 0 },
  powershell_build: { bin: 'pwsh', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'if (Test-Path package.json) { npm install --ignore-scripts --no-audit --no-fund; npm run build --if-present } else { Write-Output "No package.json; no package build required." }'], validate: args => args.length === 0 },
  powershell_test: { bin: 'pwsh', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'if (Test-Path package.json) { npm run test --if-present } else { Write-Output "No package.json; no automated test command is available." }'], validate: args => args.length === 0 },
  powershell_package: { bin: 'pwsh', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'if (Test-Path artifact.zip) { Remove-Item artifact.zip -Force }; Compress-Archive -Path * -DestinationPath artifact.zip -Force; Write-Output "artifact.zip created"'], validate: args => args.length === 0 },
  npm_install: { bin: 'npm', args: ['install'], validate: args => args.length === 0 },
  npm_ci: { bin: 'npm', args: ['ci'], validate: args => args.length === 0 },
  npm_test: { bin: 'npm', args: ['test'], validate: args => args.length === 0 },
  npm_build: { bin: 'npm', args: ['run', 'build'], validate: args => args.length === 0 },
  python_test: { bin: 'python3', args: ['-m', 'pytest'], validate: args => args.length === 0 },
  android_build: { bin: './gradlew', args: ['assembleDebug'], validate: args => args.length === 0 },
  electron_linux: { bin: 'npx', args: ['electron-builder', '--linux'], validate: args => args.length === 0 },
  electron_windows: { bin: 'npx', args: ['electron-builder', '--win'], validate: args => args.length === 0 },
  git_status: { bin: 'git', args: ['status', '--short'], validate: args => args.length === 0 },
};

function runTool(tool, cwd = '.', extraArgs = [], timeout = DEFAULT_TIMEOUT) {
  const spec = TOOLS[tool];
  if (!spec) throw new Error(`Unsupported tool: ${tool}`);
  if (!spec.validate(extraArgs)) throw new Error(`Invalid arguments for tool: ${tool}`);
  const dir = safePath(cwd);
  return new Promise((resolve, reject) => {
    const child = spawn(spec.bin, [...spec.args, ...extraArgs], {
      cwd: dir,
      env: { PATH: process.env.PATH, HOME: path.join(ROOT, '.home'), npm_config_cache: path.join(ROOT, '.cache', 'npm'), CI: '1' },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch {} reject(new Error(`Tool timed out after ${timeout}ms`)); }, timeout);
    child.stdout.on('data', b => { stdout += b.toString(); });
    child.stderr.on('data', b => { stderr += b.toString(); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => { clearTimeout(timer); resolve({ code: code ?? 1, stdout: stdout.slice(-20000), stderr: stderr.slice(-20000) }); });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (!auth(req)) return json(res, 401, { error: 'Unauthorized runner session' });
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, service: 'zyraxon-runner', isolated: true, workspace: '/workspace' });
    if (req.method === 'GET' && req.url === '/tools') return json(res, 200, { tools: Object.keys(TOOLS), targets: ['web', 'android', 'linux', 'windows'] });
    if (req.method === 'POST' && req.url === '/workspace/file') {
      const data = await body(req); const file = safePath(data.path); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, String(data.content ?? ''), 'utf8');
      return json(res, 200, { ok: true, path: path.relative(ROOT, file) });
    }
    if (req.method === 'POST' && req.url === '/workspace/read') {
      const data = await body(req); const file = safePath(data.path); return json(res, 200, { ok: true, path: path.relative(ROOT, file), content: await readFile(file, 'utf8') });
    }
    if (req.method === 'POST' && req.url === '/workspace/list') {
      const data = await body(req); const dir = safePath(data.path || '.');
      return json(res, 200, { ok: true, path: path.relative(ROOT, dir), entries: await readdir(dir, { withFileTypes: true }).then(xs => xs.map(x => ({ name: x.name, type: x.isDirectory() ? 'directory' : 'file' }))) });
    }
    if (req.method === 'POST' && req.url === '/execute') {
      const data = await body(req); const result = await runTool(String(data.tool || ''), data.cwd || '.', [], Math.min(Number(data.timeout || DEFAULT_TIMEOUT), 300_000));
      return json(res, result.code === 0 ? 200 : 422, { ok: result.code === 0, ...result });
    }
    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, 400, { error: error instanceof Error ? error.message : 'Runner error' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`ZYRAXON runner listening on :${PORT}`));
