import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_ZEN_MODEL,
  ZEN_CHAT_URL,
  normalizeZenModel,
  resolveApiKey,
  testZenModel,
  discoverConsoleModels,
  zenChatStream,
  zenFreeModels,
  isZenModel,
  type BuilderAttachment,
  type ChatMessage,
} from "@/lib/builder/zen.server";
import { providerChatStream } from "@/lib/builder/gateway.server";
import { MAX_MEDIA_PARTS } from "@/lib/providers/media";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function requestApiKey(request: Request, body?: any) {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer "))
    return authorization.slice(7).trim() || undefined;
  return typeof body?.apiKey === "string" ? body.apiKey.trim() || undefined : undefined;
}

/** '' | 'zyraxon' | 'opencode' → Zen free pool. Anything else → universal provider gateway. */
function routeProvider(providerId: any): string {
  const id = typeof providerId === "string" ? providerId.trim().toLowerCase() : "";
  return !id || id === "zyraxon" || id === "opencode" ? "zyraxon" : id;
}

export const Route = createFileRoute("/api/public/builder/chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const healthModel = url.searchParams.get("health");
        const apiKey = requestApiKey(request);

        if (healthModel) {
          const result = await testZenModel(healthModel, apiKey);
          return Response.json(
            { ...result, provider: "opencode-zen", keyless: !resolveApiKey(apiKey) },
            {
              status: result.ok ? 200 : result.status >= 400 ? result.status : 502,
              headers: CORS,
            },
          );
        }

        const [freeModels, discovery] = await Promise.all([
          zenFreeModels(),
          discoverConsoleModels(apiKey),
        ]);
        return Response.json(
          {
            models: freeModels,
            defaultModel: DEFAULT_ZEN_MODEL,
            gateway: ZEN_CHAT_URL,
            keyless: !resolveApiKey(apiKey),
            serverKeyConfigured: Boolean(resolveApiKey()),
            discoveredModelIds: discovery.ids,
            discoveryOk: discovery.ok,
          },
          { headers: CORS },
        );
      },

      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
        }

        const messages: ChatMessage[] = Array.isArray(body?.messages)
          ? body.messages
              .filter(
                (message: any) =>
                  message &&
                  (message.role === "user" || message.role === "assistant") &&
                  (typeof message.content === "string" || Array.isArray(message.content)),
              )
              .slice(-32)
          : [];
        if (!messages.length)
          return Response.json({ error: "messages required" }, { status: 400, headers: CORS });

        const attachments: BuilderAttachment[] = (
          Array.isArray(body?.attachments) ? body.attachments : []
        )
          .filter(
            (attachment: any) =>
              attachment &&
              typeof attachment.name === "string" &&
              typeof attachment.mime === "string" &&
              typeof attachment.data === "string",
          )
          // Images, audio, video and documents all pass. PDFs used to be dropped
          // here, which is why an attached PDF silently vanished.
          .filter((attachment: any) =>
            /^(image|audio|video)\//i.test(attachment.mime) ||
            /^application\/pdf$/i.test(attachment.mime),
          )
          // The cap matches the media planner's part ceiling. When it was smaller,
          // a video ffmpeg had correctly cut into more parts had its tail dropped
          // here with no error, so the model saw only the opening seconds.
          .slice(0, MAX_MEDIA_PARTS)
          .map((attachment: any) => ({
            name: attachment.name.slice(0, 160),
            mime: attachment.mime.slice(0, 100),
            data: attachment.data,
          }));

        const apiKey = requestApiKey(request, body);
        const requestedModel =
          typeof body?.model === "string" && body.model.trim()
            ? body.model.trim()
            : DEFAULT_ZEN_MODEL;

        // ── Route 1: OpenCode Zen free pool (pinned, always available) ──
        if (
          routeProvider(body?.providerId) === "zyraxon" &&
          (!body?.providerId || isZenModel(normalizeZenModel(requestedModel)))
        ) {
          return await zenChatStream(
            normalizeZenModel(requestedModel),
            messages,
            apiKey,
            attachments,
          );
        }

        // ── Route 2: any of the ~193 models.dev providers through their own key ──
        return await providerChatStream({
          providerId:
            routeProvider(body?.providerId) === "zyraxon"
              ? "opencode"
              : String(body.providerId).trim().toLowerCase(),
          model: normalizeZenModel(requestedModel),
          apiKey,
          messages,
          attachments,
          maxOutputTokens: Number(body?.maxOutputTokens) || undefined,
        });
      },
    },
  },
});
