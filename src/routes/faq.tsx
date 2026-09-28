import { createFileRoute, Link } from "@tanstack/react-router";

const FAQS = [
  {
    q: "What is ZYRAXON AI?",
    a: "ZYRAXON AI is a free and open-source desktop AI coding agent with 805 tools across 63 categories, 10 agent modes, screen vision, eternal memory and support for 25+ AI providers.",
  },
  {
    q: "Is ZYRAXON AI free to use?",
    a: "Yes. The Free tier includes 126 tools at $0. Paid tiers (Pro $5, Max $15, Ultra $99) unlock more tools and features, but the core agent is free and open-source.",
  },
  {
    q: "Which platforms does ZYRAXON AI support?",
    a: "ZYRAXON Agent runs on Windows, macOS and Linux (Electron desktop app). One app for everything — coding, automation, vision, voice and a built-in Monaco AI editor.",
  },
  {
    q: "How do I download ZYRAXON AI?",
    a: "Visit the Download page, pick your platform (Windows, macOS or Linux) and run the installer. You can also clone the GitHub repository and build from source with Bun.",
  },
  {
    q: "What are the agent modes?",
    a: "10 modes: General, Build, Plan, Beast, PRO, APEX PREDATOR, DARK EMPEROR, Vision, Pro Builder and AUTO. Each mode unlocks different capabilities from read-only planning to autonomous multi-file editing.",
  },
  {
    q: "What is the ZYRAXON Ecosystem?",
    a: "The Ecosystem is our marketplace where developers publish plugins, AI bots, templates, extensions and tools. Anyone can browse, install and share community apps.",
  },
  {
    q: "What is ZSL License?",
    a: "ZSL (Zyraxon Source License) is our custom source-available license. ZSL-X v1.0.0 covers 2026-2028 and governs how ZYRAXON source code can be used and redistributed.",
  },
  {
    q: "Can I publish my own app to the marketplace?",
    a: "Yes. Open the Ecosystem page, click Publish, fill in your app details and it goes live after review. You need a ZYRAXON Hub account to publish.",
  },
  {
    q: "Does ZYRAXON AI work offline?",
    a: "The desktop agent runs locally. Tools, memory and control systems work offline. AI responses require an internet connection to your chosen provider (or a local model).",
  },
  {
    q: "Which AI providers are supported?",
    a: "25+ providers including OpenAI, Anthropic, Google, OpenRouter, Groq, Mistral, Ollama (local) and more. You can switch providers per session.",
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — ZYRAXON AI Frequently Asked Questions" },
      {
        name: "description",
        content:
          "Answers to common questions about ZYRAXON AI: pricing, download, agent modes, ecosystem marketplace, ZSL license, supported platforms and AI providers.",
      },
      { property: "og:title", content: "FAQ — ZYRAXON AI Frequently Asked Questions" },
      {
        property: "og:description",
        content:
          "Answers to common questions about ZYRAXON AI: pricing, download, agent modes, ecosystem marketplace, ZSL license and supported platforms.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/faq" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "FAQ — ZYRAXON AI" },
      {
        name: "twitter:description",
        content: "Answers to common questions about ZYRAXON AI: pricing, download, agent modes and more.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Support</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-muted-foreground">
          Quick answers about ZYRAXON AI — download, pricing, agent modes and the ecosystem
          marketplace.
        </p>

        <div className="mt-10 divide-y divide-border">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-foreground list-none">
                {f.q}
                <span className="text-muted-foreground transition group-open:rotate-45 text-xl leading-none">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-border bg-muted/50 p-6">
          <h2 className="text-lg font-semibold text-foreground">Still have questions?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open the AI Help Agent (bottom-left) or visit our{" "}
            <Link to="/docs" className="text-primary underline underline-offset-4">
              documentation
            </Link>{" "}
            for detailed guides.
          </p>
        </div>
      </div>
    </main>
  );
}
