import { createFileRoute } from "@tanstack/react-router";
import { brandChatStream, brandCatalogue } from "@/lib/providers/zyraxon-brand.server";
import { fallbackComplete, fallbackConfigured } from "@/lib/providers/helper-fallback.server";
import { askConversation, conversationConfigured } from "@/lib/providers/helper-conversation.server";
import { helperWirePrompt } from "@/lib/providers/helper-prompt.server";
import { STAR_GOAL, STAR_REPO, STAR_REPO_URL } from "@/lib/providers/star-gate";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

/** The models the helper may use, in the order it should try them.
 *
 *  Fastest first, so the common case is quick. The helper rotates through the
 *  list, so if one model is rate-limited or slow the answer still arrives —
 *  which is the whole point of running on our own provider rather than one
 *  hardcoded model. */
const HELPER_MODELS = [
  "zyraxon-apex",
  "zyraxon-pulse",
  "zyraxon-titan",
  "zyraxon-codex",
  "zyraxon-matrix",
  "zyraxon-neural",
  "zyraxon-genesis",
];

/** The prompt for our own provider. Built from the shared module so the brand
 *  path and the OpenHands conversation cannot describe the product differently. */
function systemPrompt(): string {
  return helperWirePrompt();
}

/** The tools the helper may call. Both run on the server, so the browser never
 *  sees an API key and a slow search cannot block the reply. */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Search the web for current information. Use for news, versions, or anything not covered by the site pages.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_page",
      description: "Fetch a web page and return its readable text.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "The absolute URL to read." } },
        required: ["url"],
      },
    },
  },
] as const;

async function runSearch(query: string): Promise<string> {
  const key = (process.env.GOOGLE_CSE_API_KEY || "").trim();
  const cx = (process.env.GOOGLE_CSE_ID || "").trim();
  if (!key || !cx) return "Web search is not configured on this deployment.";
  const params = new URLSearchParams({ key, cx, q: query, num: "5" });
  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return `Search failed with status ${res.status}.`;
    const data: any = await res.json();
    const items = (data.items || []).slice(0, 5);
    if (!items.length) return "No results.";
    return items
      .map((it: any) => `- ${it.title}\n  ${it.link}\n  ${(it.snippet || "").replace(/\s+/g, " ")}`)
      .join("\n");
  } catch (e) {
    return `Search failed: ${e instanceof Error ? e.message : "unknown"}`;
  }
}

async function runFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "zyraxon-helper/1.0" } });
    if (!res.ok) return `Fetch failed with status ${res.status}.`;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000);
  } catch (e) {
    return `Fetch failed: ${e instanceof Error ? e.message : "unknown"}`;
  }
}

async function runTool(name: string, args: any): Promise<string> {
  if (name === "search_web") return runSearch(String(args?.query || ""));
  if (name === "fetch_page") return runFetch(String(args?.url || ""));
  return `Unknown tool: ${name}`;
}

/** One non-streaming turn, used inside the tool loop.
 *
 *  `via` is the upstream to use: a brand id, which goes through our own line, or
 *  "fallback", which goes straight to the configured second upstream. Both paths
 *  return the same shape, so the loop below does not care which one answered —
 *  and, more importantly, the system prompt is the same either way, so the reply
 *  reads as ZYRAXON Apex regardless of what served it. */
async function completeTurn(
  via: string,
  messages: any[],
  withTools: boolean,
  onDelta?: (text: string) => void,
): Promise<{ content: string; toolCalls: any[] } | null> {
  const tools = withTools ? (TOOLS as any) : undefined;

  if (via === FALLBACK_LABEL) {
    const turn = await fallbackComplete(messages, withTools ? TOOLS : undefined);
    if (!turn) return null;
    // Replay a finished answer in pieces for the same reason the brand path
    // does: the panel should fill in as it is read, not land all at once.
    if (onDelta && turn.content && !turn.toolCalls.length) {
      for (const piece of chunkForDisplay(turn.content)) {
        onDelta(piece);
        await new Promise((r) => setTimeout(r, 12));
      }
    }
    return turn;
  }

  const res = await brandChatStream(via, messages as any, undefined, {
    stream: false,
    tools,
  });
  if (!res.ok) return null;
  const data: any = await res.json().catch(() => null);
  if (!data || data.error) return null;
  const choice = data.choices?.[0];
  if (!choice) return null;
  const content = choice.message?.content || "";
  const toolCalls = choice.message?.tool_calls || [];
  // The tool loop is non-streaming, but the final answer should not be: replay
  // it in pieces so the caller watches it appear rather than landing at once.
  if (onDelta && content && !toolCalls.length) {
    for (const piece of chunkForDisplay(content)) {
      onDelta(piece);
      await new Promise((r) => setTimeout(r, 12));
    }
  }
  return { content, toolCalls };
}

/** The label the loop uses for the second upstream, so it is never confused
 *  with a brand id from the catalogue. */
const FALLBACK_LABEL = "fallback";

/** The label reported for the OpenHands conversation backend.
 *
 *  Deliberately the flagship brand name rather than a backend name: this value
 *  reaches the panel, and the visitor is owed the same answer the brand path
 *  gives — "ZYRAXON Apex" — not a note about which system served them. */
const CONVERSATION_LABEL = "zyraxon-apex";

/** Run the tool loop against one upstream.
 *
 *  Shared by the brand pass and the fallback pass so the two cannot drift: the
 *  same bounded rounds, the same tools, the same "answer or rotate" decision.
 *  Returns true when an answer was sent. */
async function runToolLoop(
  via: string,
  messages: any[],
  send: (obj: unknown) => void,
): Promise<boolean> {
  const working = messages.slice();
  for (let round = 0; round < 3; round++) {
    send({ type: "thinking", model: via, round });
    const turn = await completeTurn(via, working, round < 2, (delta) =>
      send({ type: "delta", text: delta }),
    );
    if (!turn) return false;

    if (!turn.toolCalls.length) {
      send({ type: "answer", text: turn.content, model: via });
      return true;
    }

    working.push({
      role: "assistant",
      content: turn.content || null,
      tool_calls: turn.toolCalls,
    });
    for (const call of turn.toolCalls) {
      send({ type: "tool", name: call.function.name });
      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        /* leave empty */
      }
      const result = await runTool(call.function.name, args);
      working.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  // Rounds exhausted without a plain answer: the upstream is reachable but not
  // converging, which is a failure for this purpose.
  return false;
}

/** Split a finished reply into small pieces, for a live-typing effect.
 *
 *  The tool loop has to be non-streaming — it needs the whole message to know
 *  whether the model asked for a tool — so the answer is complete before the
 *  caller sees any of it. Sending it in small pieces makes the panel fill in as
 *  it reads instead of jumping from empty to a wall of text. The split keeps the
 *  text byte-for-byte, so what is displayed is exactly what was written. */
function chunkForDisplay(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    let rest = line;
    while (rest.length > 24) {
      out.push(rest.slice(0, 24));
      rest = rest.slice(24);
    }
    out.push(rest + "\n");
  }
  return out;
}

export const Route = createFileRoute("/api/public/zyraxon/helper")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      /** Which models the helper can use, and whether search is live. */
      GET: async () => {
        let models: string[] = HELPER_MODELS;
        try {
          const catalogue = await brandCatalogue();
          const live = new Set<string>(catalogue.map((b) => b.id as string));
          const preferred = HELPER_MODELS.filter((m) => live.has(m));
          models = preferred.length ? preferred : HELPER_MODELS;
        } catch {
          /* keep the static list */
        }
        return Response.json(
          {
            models,
            fastest: models[0],
            search: Boolean((process.env.GOOGLE_CSE_API_KEY || "").trim()),
            // Whether a second upstream is configured. A visitor-facing status
            // read, not a secret: it says the assistant has somewhere to go
            // when our own line is down, without naming where that is.
            fallback: fallbackConfigured(),
            // Whether the shared OpenHands conversation backend is available.
            // Reported the same way: a capability, not an address.
            conversation: conversationConfigured(),
          },
          { headers: { ...CORS, "Cache-Control": "public, max-age=120" } },
        );
      },

      /** The chat turn, streamed as plain newline-delimited events so the
       *  browser can show "thinking" before the answer begins. */
      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
        }

        const message = typeof body?.message === "string" ? body.message.trim() : "";
        if (!message)
          return Response.json({ error: "message is required" }, { status: 400, headers: CORS });

        const history: Array<{ role: string; content: string }> = Array.isArray(body?.history)
          ? body.history
              .filter(
                (m: any) =>
                  m && typeof m.content === "string" && ["user", "assistant"].includes(m.role),
              )
              .slice(-8)
          : [];

        const enc = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (obj: unknown) =>
              controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
            const messages: any[] = [
              { role: "system", content: systemPrompt() },
              ...history,
              { role: "user", content: message },
            ];

            // Keep the connection alive while a model thinks or a tool runs.
            const beat = setInterval(() => {
              try {
                controller.enqueue(enc.encode("\n"));
              } catch {
                /* closed */
              }
            }, 10_000);

            try {
              // First pass: our own line, rotating through the brands as before.
              let answered = false;
              for (const model of HELPER_MODELS) {
                if (await runToolLoop(model, messages, send)) {
                  answered = true;
                  break;
                }
                send({ type: "rotating", model });
              }

              // Second pass: the configured OpenAI-compatible fallback.
              if (!answered && fallbackConfigured()) {
                send({ type: "rotating", model: FALLBACK_LABEL });
                answered = await runToolLoop(FALLBACK_LABEL, messages, send);
              }

              // Third pass: the shared OpenHands conversation. This is the
              // backend that survives our own line being spent, and it is the
              // last thing tried before the visitor is told we are down. The
              // reply is written by the same prompt the brand path uses, so the
              // assistant still answers as ZYRAXON Apex and still names no
              // upstream — a visitor cannot tell which backend served them.
              if (!answered && conversationConfigured()) {
                send({ type: "rotating", model: CONVERSATION_LABEL });
                const reply = await askConversation(message);
                if (reply) {
                  for (const piece of chunkForDisplay(reply)) {
                    send({ type: "delta", text: piece });
                    await new Promise((r) => setTimeout(r, 12));
                  }
                  send({ type: "answer", text: reply, model: CONVERSATION_LABEL });
                  answered = true;
                }
              }

              if (!answered) {
                // Both upstreams are down. The visitor still gets something
                // useful: the goal the whole provider is waiting on, and the
                // one action that moves it.
                send({
                  type: "answer",
                  text:
                    `I could not reach a model just now, so I cannot answer this one. ` +
                    `That is on our side, not yours — please try again in a few minutes, or read the docs at /docs.\n\n` +
                    `While I am down: our provider opens when this repository reaches ` +
                    `${STAR_GOAL.toLocaleString("en-US")} stars on GitHub, and it is at ` +
                    `${STAR_REPO} right now. A star moves that closer.\n\n` +
                    `${STAR_REPO_URL}`,
                });
              }
              send({ type: "done" });
            } catch (e) {
              send({
                type: "answer",
                text: `Something went wrong: ${e instanceof Error ? e.message : "unknown"}`,
              });
              send({ type: "done" });
            } finally {
              clearInterval(beat);
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            ...CORS,
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
