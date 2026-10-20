import { createFileRoute } from "@tanstack/react-router";
import { brandChatStream, brandCatalogue } from "@/lib/providers/zyraxon-brand.server";
import { DOCS } from "@/lib/docs/content";
import { PROVIDER_INTEGRATION_DOCS } from "@/lib/docs/provider-integration-docs";

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

/** Everything the site knows about itself, as text for the model.
 *
 *  Built from the same `DOCS` registry the /docs pages render from, plus the
 *  route list, so the helper cannot describe a page the site does not have —
 *  and a doc added later is known to the helper with no second edit. */
function siteKnowledge(): string {
  const lines: string[] = [];
  lines.push("## Documentation pages (these are the real /docs/<slug> routes)");
  for (const doc of DOCS) {
    const body = doc.blocks
      .map((b) => ("text" in b ? b.text : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 900);
    lines.push(`- /docs/${doc.slug} — ${doc.title} (${doc.group}): ${doc.desc} ${body}`);
  }
  lines.push("");
  lines.push("## Provider integration guide (the /providers page and its docs)");
  for (const page of PROVIDER_INTEGRATION_DOCS) {
    const body = page.blocks
      .map((b) => ("text" in b ? b.text : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 700);
    lines.push(`- /docs/${page.slug} — ${page.title}: ${page.desc} ${body}`);
  }
  return lines.join("\n");
}

/** The routes a visitor can reach, so the helper points at real pages. */
const ROUTES = [
  "/ — home",
  "/apps — the MCP app directory (108 verified integrations)",
  "/ecosystem — the ZYRAXON ecosystem",
  "/docs — documentation index; every page is /docs/<slug>",
  "/packages — the 12 published npm packages",
  "/extensions — the Open VSX extensions directory",
  "/releases — release feed and downloads",
  "/demo — video walkthroughs",
  "/community-art — the community roster",
  "/faq — frequently asked questions",
  "/providers — the ZYRAXON provider, ten models, one OpenAI-compatible endpoint",
  "/builder — the AI web builder",
  "/bludar — Bludar Studio",
  "/nebula — Nebula Core",
  "/publish — publish a site",
  "/updates — product updates",
  "/download/zyraxon-agent — the download page",
  "/zsl — the Zyraxon Sovereign License",
  "/desktop-feedback — send feedback or open an issue",
  "/privacy-policy — privacy policy",
];

function systemPrompt(): string {
  return `You are the ZYRAXON AI helper, the assistant built into the ZYRAXON website.
You answer questions about ZYRAXON and this site, and you can look things up.

Facts you can rely on:
- ZYRAXON is a free, source-available desktop AI coding agent (Electron + SolidJS + Bun), a fork of OpenCode made far more capable.
- GitHub: https://github.com/onelpawarai-X/ZYRAXON-AI
- License: ZSL-X v2.0.0 (Zyraxon Sovereign License).
- The provider serves ten branded models over one OpenAI-compatible endpoint at
  https://zyraxonai.lovable.app/api/public/zyraxon/v1 — see /providers.
- The helper itself runs on that provider, rotating through its models.

Pages on this site:
${ROUTES.join("\n")}

${siteKnowledge()}

Tools you have:
- search_web: real-time web search. Use it for anything current, or when the
  site's own pages do not answer the question. Do not guess at news or versions.
- fetch_page: read a URL's text, including pages on this site.

How to answer:
- Write in the language the visitor used. Bengali question, Bengali answer.
- Be concise and concrete. Point at the exact page or command.
- When you use a tool, do not narrate the mechanics; just answer from what you found.
- Never invent a download link, a version number or a feature. If the site pages
  do not say, search, and if that fails, say plainly that you do not know.
- Never mention the upstream model or vendor behind the provider. You are a
  ZYRAXON assistant.

Writing code — this is a first-class job, not an afterthought:
- You are a coding assistant as much as a site guide. When the visitor asks for
  code, write the complete, runnable thing. No "rest of the code here", no
  placeholders, no omissions.
- Always put code in a fenced block with a language tag, e.g. \`\`\`python,
  \`\`\`bash, \`\`\`typescript, \`\`\`json, \`\`\`html. The panel renders these as
  real code blocks with a copy button, so an untagged block looks broken.
- When the code is a file, name the file in the fence info line after the
  language, e.g. \`\`\`python file:app.py. The panel shows that label.
- Write code that actually runs. Include the import, the client setup and the
  call. Prefer the standard library where it is enough.
- To call the ZYRAXON provider, use base URL
  https://zyraxonai.lovable.app/api/public/zyraxon/v1 and any model id from
  /api/public/zyraxon/v1/models. The endpoint is OpenAI-compatible.
- Do not wrap an explanation inside a code fence. Prose stays prose, code stays
  in its own fence.

Links:
- Write every link as Markdown: [label](url). They render as clickable links.
- A bare https:// URL and a site path like /docs/getting-started are also made
  clickable, but an explicit [label](url) is clearer.
- Prefer a link to the exact page over a description of where to look.`;
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

/** One non-streaming turn, used inside the tool loop. */
async function completeTurn(
  model: string,
  messages: any[],
  withTools: boolean,
  onDelta?: (text: string) => void,
): Promise<{ content: string; toolCalls: any[] } | null> {
  const res = await brandChatStream(model, messages as any, undefined, {
    stream: false,
    tools: withTools ? (TOOLS as any) : undefined,
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
              let answered = false;
              for (const model of HELPER_MODELS) {
                // A small tool loop: at most two rounds, so a confused model
                // cannot spin, and each round is one bounded request.
                let working = messages.slice();
                let ok = false;
                for (let round = 0; round < 3; round++) {
                  send({ type: "thinking", model, round });
                  // Stream the answer out in pieces as it is produced, so the
                  // panel fills in live rather than showing nothing and then
                  // everything at once.
                  const turn = await completeTurn(model, working, round < 2, (delta) =>
                    send({ type: "delta", text: delta }),
                  );
                  if (!turn) break;
                  ok = true;

                  if (!turn.toolCalls.length) {
                    send({ type: "answer", text: turn.content, model });
                    answered = true;
                    break;
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
                if (answered || ok) break;
                send({ type: "rotating", model });
              }

              if (!answered) {
                send({
                  type: "answer",
                  text: "I could not reach a model just now. Please try again, or read the docs at /docs.",
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
