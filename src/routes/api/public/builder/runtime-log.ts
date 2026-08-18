import { createFileRoute } from '@tanstack/react-router';
import { readFile, stat } from 'node:fs/promises';
import { createRequestId, logRuntime, getRuntimeLogPath } from '@/lib/builder/runtime-log.server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

function redact(text: string) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/("?(?:api[_-]?key|authorization|access[_-]?token|token)"?\s*[:=]\s*)[^,\s}]+/gi, '$1[REDACTED]');
}

export const Route = createFileRoute('/api/public/builder/runtime-log')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const requestId = createRequestId();
        const started = Date.now();
        const url = new URL(request.url);
        const requestedId = url.searchParams.get('requestId')?.trim();
        const path = getRuntimeLogPath();

        try {
          const info = await stat(path);
          let text = await readFile(path, 'utf8');
          const lines = text.split('\n').filter(Boolean);
          const selected = requestedId
            ? lines.filter((line) => line.includes(`"requestId":"${requestedId}"`))
            : lines.slice(-250);
          text = redact(selected.join('\n')) + (selected.length ? '\n' : '');
          await logRuntime(requestId, 'diagnostic_log_downloaded', {
            requestedId: requestedId || null,
            returnedEvents: selected.length,
            logBytes: info.size,
          }, Date.now() - started);
          return new Response(text || '{"message":"No diagnostic events yet."}\n', {
            status: 200,
            headers: {
              ...CORS,
              'Content-Type': 'application/x-ndjson; charset=utf-8',
              'Content-Disposition': 'attachment; filename="zyraxon-runtime.ndjson"',
              'Cache-Control': 'no-store',
              'X-ZYRAXON-Request-Id': requestId,
            },
          });
        } catch (error) {
          await logRuntime(requestId, 'diagnostic_log_unavailable', {
            error: error instanceof Error ? error.message : String(error),
          }, Date.now() - started);
          return Response.json({
            error: 'Runtime log is not available on this server instance yet.',
            requestId,
            path: 'logs/zyraxon-runtime.ndjson',
          }, { status: 404, headers: { ...CORS, 'X-ZYRAXON-Request-Id': requestId } });
        }
      },
    },
  },
});
