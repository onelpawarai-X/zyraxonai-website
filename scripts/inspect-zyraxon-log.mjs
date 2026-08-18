import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'logs/zyraxon-runtime.ndjson');
try {
  const text = await readFile(file, 'utf8');
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const last = lines.slice(-100).map(line => {
    try { return JSON.stringify(JSON.parse(line), null, 2); }
    catch { return line; }
  });
  console.log(last.join('\n'));
} catch {
  console.log(`No runtime log found yet: ${file}`);
  console.log('Send one message through ZYRAXON AI first, then run this command again.');
}
