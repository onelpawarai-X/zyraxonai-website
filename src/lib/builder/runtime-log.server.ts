import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const LOG_DIR = join(process.cwd(), 'logs');
const LOG_FILE = join(LOG_DIR, 'zyraxon-runtime.ndjson');

export type RuntimeLog = {
  requestId: string;
  event: string;
  at: string;
  elapsedMs?: number;
  data?: Record<string, unknown>;
};

export function createRequestId() {
  return randomUUID();
}

function redact(value: unknown, max = 2400) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? {});
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/("?(?:api[_-]?key|authorization|access[_-]?token|token)"?\s*[:=]\s*)[^,\s}]+/gi, '$1[REDACTED]')
    .slice(0, max);
}

export async function writeRuntimeLog(entry: RuntimeLog) {
  const line = JSON.stringify({
    requestId: entry.requestId,
    event: entry.event,
    at: entry.at,
    elapsedMs: entry.elapsedMs,
    data: entry.data ? { redacted: redact(entry.data) } : undefined,
  }) + '\n';
  try {
    await mkdir(dirname(LOG_FILE), { recursive: true });
    await appendFile(LOG_FILE, line, 'utf8');
  } catch {
    // Logging must never break the user's request.
  }
}

export async function logRuntime(requestId: string, event: string, data?: Record<string, unknown>, elapsedMs?: number) {
  await writeRuntimeLog({ requestId, event, at: new Date().toISOString(), elapsedMs, data });
}

export function getRuntimeLogPath() {
  return LOG_FILE;
}
