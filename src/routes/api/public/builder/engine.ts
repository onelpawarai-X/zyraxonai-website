import { createFileRoute } from "@tanstack/react-router";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

/** ZYRAXON PowerShell/Shell Engine — runs ON the deployment runner (e.g. the Lovable build computer).
 *  No personal machine is ever involved: whichever host serves this site is the host that executes. */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const TIMEOUT_MS = 90_000;
const MAX_COMMAND_CHARS = 2000;
const MAX_FILES = 80;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

type Runner = { exe: string; kind: "powershell" | "posix"; baseArgs: string[] };

async function run(exe: string, args: string[], cwd: string, timeoutMs = TIMEOUT_MS) {
  return new Promise<{ started: boolean; code: number | null; stdout: string; stderr: string }>(
    (done) => {
      let stdout = "",
        stderr = "",
        settled = false;
      const child = spawn(exe, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: { ...process.env, CI: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const finish = (v: unknown) => {
        if (!settled) {
          settled = true;
          done(v);
        }
      };
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignored */
        }
        finish({
          started: true,
          code: null,
          stdout,
          stderr: `${stderr}\nTimed out after ${timeoutMs}ms.`,
        });
      }, timeoutMs);
      child.stdout.on("data", (c) => {
        stdout += String(c);
        if (stdout.length > 120_000) stdout = stdout.slice(-120_000);
      });
      child.stderr.on("data", (c) => {
        stderr += String(c);
        if (stderr.length > 60_000) stderr = stderr.slice(-60_000);
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        finish({ started: false, code: null, stdout, stderr: e.message });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        finish({ started: true, code, stdout, stderr });
      });
    },
  );
}

function argsFor(runner: Runner, command: string): string[] {
  if (runner.kind === "powershell") return [...runner.baseArgs, "-Command", command];
  return [...runner.baseArgs, command];
}

async function findRunner(): Promise<Runner | null> {
  const probe = (exe: string, baseArgs: string[], kind: Runner["kind"]) =>
    run(
      exe,
      [
        ...baseArgs,
        kind === "powershell" ? "$PSVersionTable.PSVersion.ToString()" : "-c",
        kind === "posix" ? "echo ok" : "",
      ].filter(Boolean),
      process.cwd(),
      8_000,
    );
  for (const [exe, baseArgs] of [
    ["pwsh", ["-NoLogo", "-NoProfile", "-NonInteractive"]],
    ["powershell", ["-NoLogo", "-NoProfile", "-NonInteractive"]],
  ] as const) {
    const r = await probe(exe as string, baseArgs as unknown as string[], "powershell").catch(
      () => null,
    );
    if (r?.started && r.code === 0)
      return { exe, kind: "powershell", baseArgs: baseArgs as unknown as string[] };
  }
  for (const exe of ["bash", "sh"]) {
    const r = await run(exe, ["-c", "echo ok"], process.cwd(), 8_000).catch(() => null);
    if (r?.started && r.code === 0) return { exe, kind: "posix", baseArgs: ["-c"] };
  }
  return null;
}

/** Guardrail: block commands that could destroy the runner host itself. */
const DENYLIST = [
  /rm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)[^|;]*\s+\/(\s|$)/i,
  /mkfs(\.\w+)?\b/i,
  /\b(shutdown|reboot|halt|poweroff)\b/i,
  /:\(\)\s*\{\s*:\|&\s*\}\s*;/,
  /\bdd\s+if=\/dev\/(zero|random)\s+of=\/dev\/[sh]d/i,
  /\b(format|cipher)\s+\/?[wc]:/i,
  /remove-item\b[^|;]*(--recurse|-recurse|-recurse)[^|;]*[c-d]:\\(\s|$)/i,
  /\bdel\s+\/[sfq]\b/i,
];

function safeRelativePath(value: string): string | null {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.split("/").some((part) => part === "..")
  )
    return null;
  return normalized;
}

export const Route = createFileRoute("/api/public/builder/engine")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        const runner = await findRunner();
        return Response.json(
          {
            available: !!runner,
            executor: runner ? `${runner.exe} (${runner.kind})` : null,
            host: "deployment-runner",
            capability:
              "ZYRAXON Agent Engine — real commands on the computer that serves this website",
            note: "Set nothing up manually. On Windows-capable runners you can also preinstall PowerShell with: npm run engine:setup",
          },
          { headers: CORS },
        );
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
        }

        const command = typeof body?.command === "string" ? body.command.trim() : "";
        if (!command)
          return Response.json({ error: "command required" }, { status: 400, headers: CORS });
        if (command.length > MAX_COMMAND_CHARS)
          return Response.json(
            { error: `Command too long (max ${MAX_COMMAND_CHARS} chars)` },
            { status: 413, headers: CORS },
          );
        if (DENYLIST.some((rx) => rx.test(command)))
          return Response.json(
            { error: "Blocked: this command could damage the shared runner and is not allowed." },
            { status: 403, headers: CORS },
          );

        const runner = await findRunner();
        if (!runner)
          return Response.json(
            {
              error: "No shell runtime found on this deployment runner.",
              setup:
                "Windows runners: npm run engine:setup && npm run engine:start · Linux/macOS runners already provide bash.",
            },
            { status: 503, headers: CORS },
          );

        const requestedTimeout = Number(body?.timeoutMs);
        const timeoutMs = Number.isFinite(requestedTimeout)
          ? Math.min(Math.max(requestedTimeout, 1_000), 600_000)
          : TIMEOUT_MS;

        const workspace = await mkdtemp(join(tmpdir(), "zyraxon-agent-"));
        try {
          const files =
            body?.files && typeof body.files === "object"
              ? Object.entries(body.files as Record<string, unknown>)
              : [];
          if (files.length > MAX_FILES)
            return Response.json(
              { error: `Too many files (max ${MAX_FILES})` },
              { status: 413, headers: CORS },
            );
          let total = 0;
          for (const [rawName, rawContent] of files) {
            const name = safeRelativePath(rawName);
            if (!name || typeof rawContent !== "string")
              return Response.json(
                { error: `Invalid file path: ${rawName}` },
                { status: 400, headers: CORS },
              );
            total += Buffer.byteLength(rawContent, "utf8");
            if (total > MAX_TOTAL_BYTES)
              return Response.json(
                { error: "Workspace payload too large" },
                { status: 413, headers: CORS },
              );
            const target = resolve(workspace, name);
            if (!target.startsWith(workspace + sep))
              return Response.json({ error: "Unsafe file path" }, { status: 400, headers: CORS });
            await mkdir(target.slice(0, target.length - name.split("/").pop()!.length), {
              recursive: true,
            });
            await writeFile(target, rawContent, "utf8");
          }

          const result = await run(runner.exe, argsFor(runner, command), workspace, timeoutMs);
          return Response.json(
            {
              ok: result.started && result.code === 0,
              exitCode: result.code,
              stdout: result.stdout.slice(-20_000),
              stderr: result.stderr.slice(-10_000),
              executor: `${runner.exe} (${runner.kind})`,
              cwd: "sandboxed workspace on the deployment runner",
            },
            { status: result.started && result.code === 0 ? 200 : 502, headers: CORS },
          );
        } finally {
          await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
        }
      },
    },
  },
});
