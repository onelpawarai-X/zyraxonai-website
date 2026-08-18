import { createFileRoute } from '@tanstack/react-router';
import {
  DEFAULT_ZEN_MODEL,
  ZEN_FREE_MODELS,
  ZEN_CHAT_URL,
  resolveZenModel,
  testZenModel,
  discoverConsoleModels,
  zenChatStream,
  type BuilderAttachment,
  type ChatMessage,
} from '@/lib/builder/zen.server';
import { createRequestId, logRuntime } from '@/lib/builder/runtime-log.server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

export const Route = createFileRoute('/api/public/builder/chat')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const requestId = createRequestId();
        const started = Date.now();
        const url = new URL(request.url);
        const healthModel = url.searchParams.get('health');
        const apiKey = url.searchParams.get('apiKey')?.trim() || undefined;
        await logRuntime(requestId, 'diagnostic_start', { method: 'GET', healthModel: healthModel || null, apiKeyProvided: Boolean(apiKey) });
        if (healthModel) {
          const result = await testZenModel(healthModel, apiKey, requestId);
          await logRuntime(requestId, 'diagnostic_complete', { ...result }, Date.now() - started);
          return Response.json({ ...result, requestId, provider: 'opencode-zen', userApiKeyRequired: false }, {
            status: result.ok ? 200 : (result.status >= 400 ? result.status : 502),
            headers: { ...CORS, 'X-ZYRAXON-Request-Id': requestId },
          });
        }
        const discovery = await discoverConsoleModels(apiKey, requestId);
        await logRuntime(requestId, 'model_discovery_complete', { ...discovery }, Date.now() - started);
        return Response.json({ models: ZEN_FREE_MODELS, defaultModel: DEFAULT_ZEN_MODEL, gateway: ZEN_CHAT_URL, userApiKeyRequired: false, discoveredModelIds: discovery.ids, discoveryOk: discovery.ok, requestId }, { headers: { ...CORS, 'X-ZYRAXON-Request-Id': requestId } });
      },

      POST: async ({ request }) => {
        const requestId = createRequestId();
        const started = Date.now();
        await logRuntime(requestId, 'request_received', { method: 'POST', url: new URL(request.url).pathname });
        let body: any;
        try { body = await request.json(); }
        catch (error) {
          await logRuntime(requestId, 'request_json_error', { error: error instanceof Error ? error.message : String(error) }, Date.now() - started);
          return Response.json({ error: 'Invalid JSON body', requestId }, { status: 400, headers: { ...CORS, 'X-ZYRAXON-Request-Id': requestId } });
        }
        const messages: ChatMessage[] = Array.isArray(body?.messages)
          ? body.messages.filter((message: any) => message && (message.role === 'user' || message.role === 'assistant') && (typeof message.content === 'string' || Array.isArray(message.content))).slice(-32)
          : [];
        if (!messages.length) {
          await logRuntime(requestId, 'request_validation_error', { reason: 'messages_required' }, Date.now() - started);
          return Response.json({ error: 'messages required', requestId }, { status: 400, headers: { ...CORS, 'X-ZYRAXON-Request-Id': requestId } });
        }
        const model = resolveZenModel(typeof body?.model === 'string' ? body.model : DEFAULT_ZEN_MODEL)?.id || DEFAULT_ZEN_MODEL;
        const attachments: BuilderAttachment[] = (Array.isArray(body?.attachments) ? body.attachments : [])
          .filter((attachment: any) => attachment && typeof attachment.name === 'string' && typeof attachment.mime === 'string' && typeof attachment.data === 'string')
          .filter((attachment: any) => /^(image|audio|video)\//i.test(attachment.mime))
          .slice(0, 6)
          .map((attachment: any) => ({ name: attachment.name.slice(0, 160), mime: attachment.mime.slice(0, 100), data: attachment.data }));
        const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : undefined;
        await logRuntime(requestId, 'request_validated', { requestedModel: model, messageCount: messages.length, attachmentCount: attachments.length, apiKeyProvided: Boolean(apiKey) }, Date.now() - started);
        const response = await zenChatStream(model, messages, apiKey, attachments, requestId);
        await logRuntime(requestId, 'request_response_ready', { status: response.status, contentType: response.headers.get('content-type'), elapsedMs: Date.now() - started });
        return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers.entries()), ...CORS, 'X-ZYRAXON-Request-Id': requestId } });
      },
    },
  },
});
