import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader, SectionLabel } from "@/components/site/SiteChrome";
import { ButtonAnchor, ButtonLink } from "@/components/site/ui";

const FAQS = [
  {
    q: "What is ZYRAXON AI?",
    a: "ZYRAXON AI is a source-available desktop AI coding agent with 888 tools across 63 categories, 11 agent modes, screen vision, eternal memory and support for 25+ AI providers.",
  },
  {
    q: "Is ZYRAXON AI free to use?",
    a: "Yes. The Free tier includes 186 tools at $0. Paid tiers (Pro $5, Max $15, Ultra $99) unlock more tools and features, but the core agent stays source-available and free to run.",
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
    a: "ZSL (Zyraxon Sovereign License) is our custom source-available license. ZSL-X v2.0.0 covers 2026-2028 and governs how ZYRAXON source code can be used and redistributed.",
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
      {
        name: "keywords",
        content: "ZYRAXON FAQ, AI agent questions, is ZYRAXON free, install ZYRAXON",
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
        content:
          "Answers to common questions about ZYRAXON AI: pricing, download, agent modes and more.",
      },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/faq" }],
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
    <PageShell contentClassName="px-6 py-10 sm:px-10 sm:py-14">
      <PageHeader
        label="Support"
        title="Frequently asked questions"
        description="Quick answers about ZYRAXON AI — download, pricing, agent modes and the ecosystem marketplace."
      />

      <div className="grid gap-3">
        {FAQS.map((f) => (
          <details key={f.q} className="zx-glass group rounded-2xl px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-foreground">
              {f.q}
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground/6 text-muted-foreground transition group-open:rotate-45">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="zx-glass mt-10 rounded-2xl p-7">
        <SectionLabel>Ask anything</SectionLabel>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Still have a question?
        </h2>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Every question asked here becomes a GitHub issue on the public ZYRAXON-AI repository, so
          the answer is searchable by everyone and you can follow it until it is closed.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonAnchor
            href="https://github.com/onelpawarai-X/ZYRAXON-AI/issues/new?labels=question&title=%5BQuestion%5D%20"
            size="md"
          >
            Ask on GitHub Issues
          </ButtonAnchor>
          <ButtonAnchor
            href="https://github.com/onelpawarai-X/ZYRAXON-AI/issues"
            variant="glass"
            size="md"
          >
            Browse all questions
          </ButtonAnchor>
          <ButtonLink to="/docs" variant="ghost" size="md">
            Read the docs
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
