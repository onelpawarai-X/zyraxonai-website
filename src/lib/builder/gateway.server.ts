/** ZYRAXON universal provider gateway — streams any models.dev provider through its OpenAI-compatible endpoint. */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { getProviderDetail, resolveProviderApi } from "@/lib/providers/modelsdev.server";
import {
  classify,
  sdkMessages,
  type BuilderAttachment,
  type ChatMessage,
} from "@/lib/builder/zen.server";

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "Access-Control-Allow-Origin": "*",
} as const;

function sse(first: string | undefined, iterator: AsyncIterator<string>, model: string) {
  const enc = new TextEncoder();
  const frame = (delta: unknown, finish: string | null) =>
    enc.encode(
      `data: ${JSON.stringify({ id: `zyraxon-gw-${Date.now()}`, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: finish }], model })}\n\n`,
    );
  return new ReadableStream<Uint8Array>({
    async start(c) {
      try {
        if (first) c.enqueue(frame({ content: first }, null));
        while (true) {
          const n = await iterator.next();
          if (n.done) break;
          if (n.value) c.enqueue(frame({ content: n.value }, null));
        }
        c.enqueue(frame({}, "stop"));
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      } catch (e) {
        c.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ error: { message: e instanceof Error ? e.message : "Provider stream failed", type: "gateway_error" } })}\n\n`,
          ),
        );
        c.enqueue(enc.encode("data: [DONE]\n\n"));
        c.close();
      }
    },
  });
}

export async function providerChatStream(opts: {
  providerId: string;
  model: string;
  apiKey?: string;
  messages: ChatMessage[];
  attachments?: BuilderAttachment[];
  multimodal?: boolean;
  maxOutputTokens?: number;
}): Promise<Response> {
  const { providerId, model } = opts;
  let api: string | null = null;
  let name = providerId;
  try {
    const detail = await getProviderDetail(providerId);
    if (detail) {
      api = resolveProviderApi(providerId, detail as unknown);
      name = detail.name;
      const known = detail.models.find((m) => m.id === model);
      if (known && opts.multimodal === undefined) opts.multimodal = known.multimodal;
    }
  } catch {
    /* fall through with null api */
  }

  if (!api) {
    return Response.json(
      {
        error: `${name} does not expose a key-based OpenAI-compatible endpoint through ZYRAXON. Try another provider.`,
        provider: providerId,
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  if (!opts.apiKey?.trim()) {
    return Response.json(
      {
        error: `Add your ${name} API key in Settings → Providers to use ${model}. Keys stay in your browser and are only forwarded per request.`,
        provider: providerId,
      },
      { status: 401, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  try {
    const p = createOpenAICompatible({
      name: `zyraxon-${providerId}`,
      baseURL: api,
      apiKey: opts.apiKey.trim(),
    });
    const messages = sdkMessages(opts.messages.slice(-32), opts.attachments || [], {
      // Safe default: only forward media when the catalog CONFIRMS vision
      // support; unknown models get media stripped with a clear note instead
      // of an upstream "I cannot read image.png" refusal.
      multimodal: opts.multimodal === true,
    });
    const result = streamText({
      model: p.chatModel(model),
      messages: messages as unknown,
      maxOutputTokens: Math.min(opts.maxOutputTokens || 16384, 32768),
      temperature: 0.2,
    });
    const iterator = result.textStream[Symbol.asyncIterator]();
    const first = await iterator.next();
    if (first.done) {
      return Response.json(
        { error: `${name} returned an empty stream for ${model}.`, provider: providerId },
        { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    return new Response(sse(first.value, iterator, model), {
      headers: { ...STREAM_HEADERS, "X-ZYRAXON-Provider": providerId, "X-ZYRAXON-Model": model },
    });
  } catch (e) {
    const c = classify(e);
    return Response.json(
      { error: `${name} request failed (${c.status}).`, detail: c.detail, provider: providerId },
      {
        status: c.status >= 400 && c.status < 600 ? c.status : 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }
}
