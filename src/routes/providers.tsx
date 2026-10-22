import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ProviderIntegrations } from "@/components/site/ProviderIntegrations";
import { ProviderRotator } from "@/components/site/ProviderRotator";
import { Button, ButtonAnchor, Card, Section, Tag } from "@/components/site/ui";
import { ZYRAXON_BRANDS } from "@/lib/providers/zyraxon-brands";
import { ENDPOINT_STATS } from "@/lib/providers/endpoints";

export const Route = createFileRoute("/providers")({
  head: () => ({
    meta: [
      {
        title:
          "ZYRAXON Provider — Free OpenAI-Compatible AI API with Ten Models (Termux, OpenHands, Cursor)",
      },
      {
        name: "description",
        content:
          "Free OpenAI-compatible AI API: ten ZYRAXON models behind one base URL, plus text to speech in 75 languages and speech to text that works on a recording or live as you speak. Works with the OpenAI SDK, LangChain, the Vercel AI SDK, OpenHands, Cursor, Cline, Aider, Termux, mobile apps and any tool that speaks /v1/chat/completions. Streaming, tool calling, images, audio, video and PDF — no API key to buy.",
      },
      {
        name: "keywords",
        content:
          "free AI API, OpenAI compatible API, OpenAI alternative, free LLM API, custom provider, base URL API key, OpenAI SDK base URL, LangChain custom provider, OpenHands custom model, Cursor custom model, Cline API, Continue.dev, Aider model, Termux AI, Kali Linux AI, LiteLLM provider, LLM Provider NOT provided, streaming chat completions, tool calling API, multimodal AI API, free GPT alternative, ZYRAXON provider, free text to speech API, free speech to text API, live transcription API, real-time speech recognition, whisper alternative, Bengali speech to text, Bengali text to speech, SSE transcription, no API key speech API",
      },
      { property: "og:title", content: "ZYRAXON Provider — Free OpenAI-Compatible AI API" },
      {
        property: "og:description",
        content:
          "Ten ZYRAXON models behind one OpenAI-compatible endpoint. Works with the OpenAI SDK, LangChain, OpenHands, Cursor, Termux and anything that speaks /v1/chat/completions.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/providers" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ZYRAXON Provider — Free OpenAI-Compatible AI API" },
      {
        name: "twitter:description",
        content:
          "Ten ZYRAXON models, one base URL, no key to buy. Streaming, tool calls, multimodal.",
      },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/providers" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "ZYRAXON Provider",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web, Windows, macOS, Linux, Android, iOS",
          description:
            "Free OpenAI-compatible AI provider exposing ten ZYRAXON branded models behind a single base URL, with streaming, tool calling and multimodal input.",
          url: "https://zyraxonai.lovable.app/providers",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          featureList: [
            "OpenAI-compatible chat completions",
            "Server-sent event streaming",
            "Function and tool calling",
            "Image, audio, video and PDF input",
            "Ten branded models behind one endpoint",
            "Text to speech in 322 voices across 75 languages",
            "Speech to text, batch or live streaming",
            "Machine-readable endpoint catalogue",
            "No API key required",
          ],
        }),
      },
      {
        // A FAQ block is what puts a page into the "people also ask" results,
        // which is where a query like "how do I use a custom provider" is
        // actually answered. The questions are the ones people type.
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Is the ZYRAXON provider free?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Ten models are served over one OpenAI-compatible endpoint with no API key to buy. Send any non-empty string as the API key unless the operator has set one.",
              },
            },
            {
              "@type": "Question",
              name: "What base URL do I use?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "https://zyraxonai.lovable.app/api/public/zyraxon/v1 — the same base URL works for the OpenAI SDK, LangChain, the Vercel AI SDK, OpenHands, Cursor, Cline, Aider, LiteLLM, Termux and any other OpenAI-compatible client.",
              },
            },
            {
              "@type": "Question",
              name: "How do I fix 'LLM Provider NOT provided' in OpenHands or LiteLLM?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Put openai/ in front of the model name, for example openai/zyraxon-codex. LiteLLM reads the text before the first slash to choose a handler and refuses a bare model id. This endpoint accepts both spellings.",
              },
            },
            {
              "@type": "Question",
              name: "Can I use this provider from Termux on Android?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. A one-command setup script installs a zyraxon client in Termux that streams replies and can run a tool-calling agent loop on the device. Kali Linux and Kali NetHunter are supported the same way.",
              },
            },
            {
              "@type": "Question",
              name: "Does the provider support tool calling and streaming?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Define tools in the OpenAI wire shape and the model returns real tool calls; set stream to true and the reply arrives as server-sent events.",
              },
            },
            {
              "@type": "Question",
              name: "Can I do text to speech and speech to text for free?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes, and without a key. POST /api/public/tts speaks text in 322 voices across 75 languages, and POST /api/public/stt transcribes audio. The speech endpoint is one URL with two modes: send a recording for the whole transcript, or stream raw PCM and receive text as the person is still speaking.",
              },
            },
            {
              "@type": "Question",
              name: "Why does the speech endpoint need a language?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Because the recogniser does not detect language. Asked for English about Bengali audio it returns English-sounding words at high confidence rather than failing, so a guess produces a confident wrong transcript. Send language=bn (or bn-BD) and the answer is right the first time.",
              },
            },
            {
              "@type": "Question",
              name: "How do I get the whole API surface in one read?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "GET https://zyraxonai.lovable.app/api/public/zyraxon/v1/endpoints returns every endpoint with its fields, response shape and example, as JSON. The /providers page carries the same catalogue for a human reader.",
              },
            },
            {
              "@type": "Question",
              name: "Which models are available?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Ten ZYRAXON models including zyraxon-apex, zyraxon-codex, zyraxon-pulse, zyraxon-titan and zyraxon-cyber. GET /api/public/zyraxon/v1/models lists them all with their live context windows and input modalities.",
              },
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://zyraxonai.lovable.app/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Provider",
              item: "https://zyraxonai.lovable.app/providers",
            },
          ],
        }),
      },
    ],
  }),
  component: ProvidersPage,
});

const API_ORIGIN = "https://zyraxonai.lovable.app";
const MODELS_URL = `${API_ORIGIN}/api/public/zyraxon/v1/models`;
const CHAT_URL = `${API_ORIGIN}/api/public/zyraxon/v1/chat/completions`;

type Live = {
  id: string;
  status: "ready" | "rotated";
  context: number;
  output: number;
  modalities?: string[];
  multimodal?: boolean;
};

const MODALITY_LABEL: Record<string, string> = {
  text: "text",
  image: "image",
  video: "video",
  audio: "audio",
  pdf: "PDF",
};

const CURL_SAMPLE = `curl ${CHAT_URL} \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "zyraxon-apex",
    "messages": [{ "role": "user", "content": "Hello" }],
    "stream": true
  }'`;

const SDK_SAMPLE = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${API_ORIGIN}/api/public/zyraxon/v1",
  apiKey: "not-needed",
});

const stream = await client.chat.completions.create({
  model: "zyraxon-codex",
  messages: [{ role: "user", content: "Build a landing page" }],
  stream: true,
});`;

function ProvidersPage() {
  const [live, setLive] = useState<Record<string, Live>>({});
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/public/zyraxon/v1/provider")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.models) return;
        const map: Record<string, Live> = {};
        for (const m of d.models as Live[]) map[m.id] = m;
        setLive(map);
      })
      .catch(() => {})
      .finally(() => alive && setChecked(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <PageShell>
      <PageHeader
        label="Provider"
        title="Ten models. One endpoint. Yours."
        description={`ZYRAXON serves its own line of ten branded models over a single OpenAI-compatible API, and rotates the pool behind those names so your code never has to change when an upstream model does. Chat and streaming, the model catalogue, text to speech and speech to text — ${ENDPOINT_STATS.total} endpoints, no key to buy, and every one of them described in full on this page.`}
      >
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <ButtonAnchor href="#endpoints" variant="primary" external={false}>
            The endpoints
          </ButtonAnchor>
          <ButtonAnchor href="#models" external={false}>
            The models
          </ButtonAnchor>
          <ButtonAnchor href="#quickstart" external={false}>
            Quickstart
          </ButtonAnchor>
          <ButtonAnchor href="#integrations" external={false}>
            Use it anywhere
          </ButtonAnchor>
          <Tag tone="success">OpenAI-compatible</Tag>
          <Tag tone="primary">Streaming</Tag>
          <Tag tone="primary">Speech, both ways</Tag>
          <Tag tone="primary">No key</Tag>
        </div>
      </PageHeader>

      <ProviderRotator />

      <Section
        id="models"
        label="The line"
        title="Ten ZYRAXON models"
        description="Each model is built for a different job. Capabilities below are read live from the serving pool, so what you see is what is answering right now."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ZYRAXON_BRANDS.map((b) => {
            const state = live[b.id];
            const rotated = state?.status === "rotated";
            const ctx = state?.context;
            return (
              <Card key={b.id} hover className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight text-foreground">
                      {b.label}
                    </h3>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{b.tagline}</p>
                  </div>
                  {state && (
                    <Tag tone={rotated ? "warn" : "success"}>{rotated ? "Rotated" : "Ready"}</Tag>
                  )}
                </div>

                <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  {b.capability}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                  <Tag>{b.id}</Tag>
                  {typeof ctx === "number" && ctx > 0 && (
                    <Tag>
                      {ctx >= 1_000_000
                        ? `${ctx / 1_000_000}M ctx`
                        : `${Math.round(ctx / 1000)}K ctx`}
                    </Tag>
                  )}
                  {(() => {
                    // Prefer the live modalities the endpoint reports; fall back
                    // to the brand's declared profile before the first fetch.
                    const mods =
                      state?.modalities ??
                      Object.entries(b.profile)
                        .filter(([, v]) => v === true)
                        .map(([k]) => (k === "vision" ? "image" : k))
                        .filter((k) => ["image", "video", "audio", "pdf"].includes(k));
                    const extra = mods.filter((m) => m !== "text");
                    if (!extra.length) return <Tag>text</Tag>;
                    return extra.map((m) => (
                      <Tag key={m} tone="primary">
                        {MODALITY_LABEL[m] ?? m}
                      </Tag>
                    ));
                  })()}
                </div>
              </Card>
            );
          })}
        </div>

        {checked && Object.keys(live).length === 0 && (
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            Live status is momentarily unavailable. The models above are still callable — status is
            informational only.
          </p>
        )}

        <Card className="mt-5 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 12a8 8 0 0113.7-5.7M20 12a8 8 0 01-13.7 5.7M17 3v4h-4M7 21v-4h4" />
              </svg>
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Automatic rotation</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Each ZYRAXON model is bound to a preferred model underneath, with every other model
                in the pool behind it as a fallback. If one is retired or rate-limited, the same
                ZYRAXON model keeps answering from the next one — so a <em>Rotated</em> badge means
                it is covering, not down. You always call the same name; we handle the swap.
              </p>
            </div>
          </div>
        </Card>
      </Section>

      <Section
        id="quickstart"
        label="Quickstart"
        title="Point your client at us"
        description="Any OpenAI-compatible client works. Two examples below."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <span className="text-[13px] font-semibold text-foreground">cURL</span>
              <Tag>shell</Tag>
            </div>
            <pre className="overflow-x-auto px-5 py-4 text-[12px] leading-relaxed text-foreground">
              <code>{CURL_SAMPLE}</code>
            </pre>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <span className="text-[13px] font-semibold text-foreground">OpenAI SDK</span>
              <Tag>typescript</Tag>
            </div>
            <pre className="overflow-x-auto px-5 py-4 text-[12px] leading-relaxed text-foreground">
              <code>{SDK_SAMPLE}</code>
            </pre>
          </Card>
        </div>

        <Card className="mt-5 p-5">
          <h3 className="text-[14px] font-semibold text-foreground">Response shape</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Standard chat-completion chunks. The <code className="text-[12px]">model</code> field
            carries the ZYRAXON name you requested, so your logs and billing stay yours.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 text-[12px] text-foreground">
            <code>{`data: {"id":"zyraxon-...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}],"model":"ZYRAXON Apex"}`}</code>
          </pre>
        </Card>
      </Section>

      <Section
        id="media"
        label="Multimodal"
        title="Send images, audio, video and documents"
        description="Chat completions accept the OpenAI content-parts array, so one message can mix text with media. When a turn carries media, it is routed to a model that can actually see it — a video turn is never sent to a text-only model and made to fail."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <span className="text-[13px] font-semibold text-foreground">
                Vision — image + text
              </span>
              <Tag>json</Tag>
            </div>
            <pre className="overflow-x-auto px-5 py-4 text-[12px] leading-relaxed text-foreground">
              <code>{`{
  "model": "zyraxon-matrix",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "What is in this chart?" },
      { "type": "image_url",
        "image_url": { "url": "data:image/png;base64,..." } }
    ]
  }]
}`}</code>
            </pre>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <span className="text-[13px] font-semibold text-foreground">
                Audio, video, documents
              </span>
              <Tag>json</Tag>
            </div>
            <pre className="overflow-x-auto px-5 py-4 text-[12px] leading-relaxed text-foreground">
              <code>{`{
  "model": "zyraxon-cyber",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "Transcribe and summarise" },
      { "type": "input_audio",
        "input_audio": { "data": "<base64>", "format": "wav" } },
      { "type": "video_url",
        "video_url": { "url": "data:video/mp4;base64,..." } },
      { "type": "file",
        "file": { "filename": "report.pdf", "file_data": "data:application/pdf;base64,..." } }
    ]
  }]
}`}</code>
            </pre>
          </Card>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Send it inline or by URL</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Every media part takes either base64 or an{" "}
              <code className="text-[12px]">https://</code> URL. Send a URL and the server fetches
              it for you, so a large file never has to pass through your request body.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Big video just works</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              A long recording is compressed and sliced in the browser before upload, so a
              multi-gigabyte file becomes a handful of model-sized parts instead of a failed
              request.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Capability-aware routing</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Every model accepts every modality. Which upstream handles your turn is measured live
              and chosen server-side, so the right model takes it without you choosing one.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Told what was used</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              A media response carries{" "}
              <code className="text-[12px]">X-ZYRAXON-Input-Modalities</code>, so you can tell a
              real multimodal answer from a text-only one.
            </p>
          </Card>
        </div>
      </Section>

      <ProviderIntegrations />
      <Section id="why" label="Why a rooted provider" title="One name you control" description="">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Stable names</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Upstream models come and go. Your <code className="text-[12px]">model</code> value
              does not have to change when they do.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Capacity pooling</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Every model in the pool stands behind every brand, so one model's limit is absorbed
              rather than passed to you.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Built to hold a flood</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Each request runs in its own lane with its own fingerprint, so one caller's rate limit
              never stalls another. Under overload a request is shed fast with a{" "}
              <code className="text-[12px]">503</code> and{" "}
              <code className="text-[12px]">Retry-After</code> instead of queueing behind a stranger
              — the lanes already running stay healthy.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-foreground">Drop-in</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Same request and response shapes as OpenAI, so existing code works with a base-URL
              change.
            </p>
          </Card>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => navigator.clipboard?.writeText(CHAT_URL)}>
            Copy chat URL
          </Button>
          <Button onClick={() => navigator.clipboard?.writeText(MODELS_URL)}>
            Copy models URL
          </Button>
        </div>
      </Section>
    </PageShell>
  );
}
