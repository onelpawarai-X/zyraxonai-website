import { createFileRoute } from '@tanstack/react-router';
import {
  DEFAULT_ZEN_MODEL,
  ZEN_FREE_MODELS,
  resolveZenModel,
  testZenModel,
  discoverConsoleModels,
  zenChatStream,
  type BuilderAttachment,
  type ChatMessage,
} from '@/lib/builder/zen.server';

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
        const url = new URL(request.url);
        const healthModel = url.searchParams.get('health');
        const apiKey = url.searchParams.get('apiKey')?.trim() || undefined;

        if (healthModel) {
          const result = await testZenModel(healthModel, apiKey);
          return Response.json({ ...result, provider: 'opencode-console', userApiKeyRequired: false }, {
            status: result.ok ? 200 : (result.status >= 400 ? result.status : 502),
            headers: CORS,
          });
        }

        const discovery = await discoverConsoleModels(apiKey);
        return Response.json({
          models: ZEN_FREE_MODELS,
          defaultModel: DEFAULT_ZEN_MODEL,
          gateway: 'https://console.opencode.ai/inference/openai/v1/chat/completions',
          userApiKeyRequired: false,
          discoveredModelIds: discovery.ids,
          discoveryOk: discovery.ok,
        }, { headers: CORS });
      },

      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
        }

        const messages: ChatMessage[] = Array.isArray(body?.messages)
          ? body.messages
              .filter((message: any) => message && (message.role === 'user' || message.role === 'assistant') && (typeof message.content === 'string' || Array.isArray(message.content)))
              .slice(-32)
          : [];
        if (!messages.length) return Response.json({ error: 'messages required' }, { status: 400, headers: CORS });

        const model = resolveZenModel(typeof body?.model === 'string' ? body.model : DEFAULT_ZEN_MODEL)?.id || DEFAULT_ZEN_MODEL;
        const attachments: BuilderAttachment[] = (Array.isArray(body?.attachments) ? body.attachments : [])
          .filter((attachment: any) => attachment && typeof attachment.name === 'string' && typeof attachment.mime === 'string' && typeof attachment.data === 'string')
          .filter((attachment: any) => /^(image|audio|video)\//i.test(attachment.mime))
          .slice(0, 6)
          .map((attachment: any) => ({
            name: attachment.name.slice(0, 160),
            mime: attachment.mime.slice(0, 100),
            data: attachment.data,
          }));

        const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : undefined;
        const response = await zenChatStream(model, messages, apiKey, attachments);
        return new Response(response.body, {
          status: response.status,
          headers: { ...Object.fromEntries(response.headers.entries()), ...CORS },
        });
      },
    },
  },
});
