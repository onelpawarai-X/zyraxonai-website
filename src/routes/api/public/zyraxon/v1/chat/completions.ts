import { createFileRoute } from "@tanstack/react-router";
import { zenChatStream, resolveZenModel, type ChatMessage } from "@/lib/builder/zen.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function providerKey(request: Request): string | undefined {
  const configured = (process.env.ZYRAXON_PROVIDER_KEY || "").trim();
  if (!configured) return undefined;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token && token === configured ? token : undefined;
}

export const Route = createFileRoute("/api/public/zyraxon/v1/chat/completions")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        if (process.env.ZYRAXON_PROVIDER_KEY && !providerKey(request)) {
          return Response.json(
            { error: { message: "Invalid provider key", type: "authentication_error" } },
            { status: 401, headers: CORS },
          );
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
            { status: 400, headers: CORS },
          );
        }

        const model = typeof body?.model === "string" ? body.model : "";
        if (!resolveZenModel(model)) {
          return Response.json(
            {
              error: {
                message: `Unknown model: ${model || "(missing)"}`,
                type: "invalid_request_error",
              },
            },
            { status: 400, headers: CORS },
          );
        }

        const messages: ChatMessage[] = Array.isArray(body?.messages)
          ? body.messages
              .filter(
                (m: any) =>
                  m &&
                  typeof m.content === "string" &&
                  ["system", "user", "assistant"].includes(m.role),
              )
              .slice(-32)
              .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 60000) }))
          : [];

        if (!messages.length) {
          return Response.json(
            { error: { message: "messages is required", type: "invalid_request_error" } },
            { status: 400, headers: CORS },
          );
        }

        const requestId =
          request.headers.get("x-request-id") ||
          `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const apiKey = providerKey(request);
        return zenChatStream(model, messages, apiKey, [], requestId);
      },
    },
  },
});
