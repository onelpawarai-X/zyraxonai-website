import { createFileRoute } from "@tanstack/react-router";
import { brandChatStream } from "@/lib/providers/zyraxon-brand.server";
import { isBrand } from "@/lib/providers/zyraxon-brands";
import { normaliseContent } from "@/lib/providers/media";
import { MAX_MEDIA_BODY_BYTES } from "@/lib/providers/media";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

/** A turn is capped so one caller cannot pin a lane indefinitely. The ceiling is
 *  generous enough for a long conversation plus several media parts, but not
 *  unbounded: an unbounded body is a memory-exhaustion vector.
 *
 *  Sized against the media budget in `media.ts`: MAX_MEDIA_PARTS parts at the
 *  planner's target, plus base64 inflation and text. The two constants must stay
 *  in step, or a correctly compressed video is refused at the door. */
const MAX_BODY_BYTES = MAX_MEDIA_BODY_BYTES;
const MAX_MESSAGES = 48;

function providerKey(request: Request): string | undefined {
  const configured = (process.env.ZYRAXON_PROVIDER_KEY || "").trim();
  if (!configured) return undefined;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  return token && token === configured ? token : undefined;
}

/** Read the request body with a hard byte ceiling.
 *
 *  `request.json()` buffers whatever arrives; a caller who streams a gigabyte
 *  would otherwise allocate a gigabyte before any validation runs. Reading
 *  incrementally and refusing past the cap bounds the memory a single request
 *  can cost, which is what keeps a flood from taking the process down. */
async function readJsonCapped(request: Request, maxBytes: number): Promise<any> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared && declared > maxBytes) {
    throw Object.assign(new Error("payload too large"), { code: "too_large", declared });
  }
  const body = request.body;
  if (!body) return JSON.parse((await request.text()) || "{}");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw Object.assign(new Error("payload too large"), { code: "too_large", declared: size });
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    merged.set(c, at);
    at += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(merged) || "{}");
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
          body = await readJsonCapped(request, MAX_BODY_BYTES);
        } catch (e: any) {
          const tooLarge = e?.code === "too_large";
          return Response.json(
            {
              error: {
                message: tooLarge
                  ? `Request body is too large. Keep media under ${Math.floor(MAX_BODY_BYTES / (1024 * 1024))} MB per request; compress or slice video client-side before sending.`
                  : "Invalid JSON body",
                type: tooLarge ? "payload_too_large" : "invalid_request_error",
              },
            },
            { status: tooLarge ? 413 : 400, headers: CORS },
          );
        }

        const model = typeof body?.model === "string" ? body.model : "";
        if (!isBrand(model)) {
          return Response.json(
            {
              error: {
                message: `Unknown model: ${model || "(missing)"}. Call GET /api/public/zyraxon/v1/models for the ZYRAXON model list.`,
                type: "invalid_request_error",
              },
            },
            { status: 400, headers: CORS },
          );
        }

        // Accept both a plain string and the multimodal parts array. Parts are
        // normalised in the provider layer; here we only keep well-formed turns
        // and cap the count so the upstream payload stays bounded.
        //
        // `tool` turns and an assistant turn's `tool_calls` are kept, not
        // dropped: a tool-calling client sends the result back as a `tool`
        // message, and an upstream that cannot match it to the call refuses the
        // turn. Filtering those out silently breaks every tool loop.
        const messages = Array.isArray(body?.messages)
          ? body.messages
              .filter((m: any) => m && ["system", "user", "assistant", "tool"].includes(m.role))
              .filter((m: any) => {
                if (m.role === "tool") return true;
                return (
                  typeof m.content === "string" ||
                  (Array.isArray(m.content) && m.content.length > 0) ||
                  (Array.isArray(m.tool_calls) && m.tool_calls.length > 0)
                );
              })
              .slice(-MAX_MESSAGES)
              .map((m: any) => {
                const out: any = { role: m.role, content: normaliseContent(m.content) };
                if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
                  out.tool_calls = m.tool_calls.filter(
                    (c: any) =>
                      c &&
                      typeof c.id === "string" &&
                      c.function &&
                      typeof c.function.name === "string",
                  );
                }
                if (typeof m.tool_call_id === "string") out.tool_call_id = m.tool_call_id;
                if (typeof m.name === "string") out.name = m.name;
                return out;
              })
          : [];

        if (!messages.length) {
          return Response.json(
            { error: { message: "messages is required", type: "invalid_request_error" } },
            { status: 400, headers: CORS },
          );
        }

        const apiKey = providerKey(request);
        // Caller-defined tools pass through verbatim. The provider keeps the
        // upstream gate tool first and appends these, so a client that defines
        // its own tools gets real tool calls instead of a text-only refusal.
        const tools = Array.isArray(body?.tools)
          ? body.tools.filter(
              (t: any) =>
                t && t.type === "function" && t.function && typeof t.function.name === "string",
            )
          : [];
        return brandChatStream(model, messages, apiKey, {
          // OpenAI's default is a single JSON object; SSE only when the caller
          // asks for it. Defaulting to streaming would break any client that
          // omits `stream` and then parses the body as JSON.
          stream: body?.stream === true,
          tools,
        });
      },
    },
  },
});
