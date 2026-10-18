import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — ZYRAXON AI" },
      { name: "description", content: "How ZYRAXON AI handles your data. Local-first, transparent, zero hidden tracking." },
      { property: "og:title", content: "Privacy Policy — ZYRAXON AI" },
      { property: "og:description", content: "How ZYRAXON AI handles your data. Local-first, transparent, zero hidden tracking." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/privacy-policy" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Privacy Policy — ZYRAXON AI" },
      { name: "twitter:description", content: "How ZYRAXON AI handles your data. Local-first, transparent, zero hidden tracking." },
    ],
  }),
  component: PrivacyPolicyPage,
});

const SECTIONS = [
  {
    id: "introduction",
    num: "01",
    title: "Introduction",
    body: "ZYRAXON AI ('we', 'our', 'us') builds a desktop AI agent that runs locally on your machine. This Privacy Policy explains what information is collected, what is processed on your device, and how your privacy is protected when you use the ZYRAXON Agent, this website, and related services. By using ZYRAXON AI you agree to the practices described here.",
  },
  {
    id: "local-first",
    num: "02",
    title: "Local-First by Design",
    body: "The ZYRAXON Agent is built to be local-first. Files, code, terminal activity, screen vision frames, voice input, and conversation history are processed on your own machine by default. No cloud account is required, and no data is uploaded to us simply by running the agent. If you choose to connect an external LLM provider, you bring your own API keys and control exactly what is sent to that provider.",
  },
  {
    id: "data-collected",
    num: "03",
    title: "Information We Collect",
    body: "This website may collect basic, non-identifying analytics such as page views, device type, browser, and referring pages to understand how visitors use the site. When you download the agent, we may record which platform (Windows or Linux) and version you downloaded. If you contact us, we keep the details you share so we can respond. We do not sell personal information, and we do not sell any data that the agent processes on your machine.",
  },
  {
    id: "agent-storage",
    num: "04",
    title: "How the Agent Stores Data",
    body: "The desktop agent stores its session data, memories, and settings locally on your computer in a SQLite database and related local files. Your conversation history, tool usage, and memory entries stay on your device. You can clear or delete this local data at any time by removing the agent's data directory from your machine.",
  },
  {
    id: "api-providers",
    num: "05",
    title: "External API Providers",
    body: "The agent can route requests to LLM providers you configure (such as OpenAI, Anthropic, Google, or others). When you use such a provider, the text you send is processed by that provider under its own terms and privacy policy. We recommend reviewing each provider's privacy policy before connecting it. We cannot see or control data that is sent directly from your machine to a third-party provider.",
  },
  {
    id: "links-and-telemetry",
    num: "06",
    title: "Links, Analytics & Telemetry",
    body: "Our website and marketplaces may include links to third-party sites which have their own privacy policies. Anonymous product-usage statistics, if any, are aggregated and cannot identify you personally. You are never required to enable telemetry to use the core agent, and most functionality works entirely offline.",
  },
  {
    id: "security",
    num: "07",
    title: "Security",
    body: "We apply reasonable technical safeguards to protect this website and the agent distribution. Since the agent is local-first, the security of data stored on your device depends on the security of your own computer. If you discover a security vulnerability, please report it privately before public disclosure.",
  },
  {
    id: "children",
    num: "08",
    title: "Children's Privacy",
    body: "ZYRAXON AI is a developer tool and is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us personal information, contact us and we will delete it.",
  },
  {
    id: "your-rights",
    num: "09",
    title: "Your Rights",
    body: "Depending on your jurisdiction, you may have the right to access, correct, export, or delete personal information relating to you. Because our agent stores its data locally on your machine, you already have direct access to everything it knows about you. For website-related data, contact us and we will help you exercise your rights within a reasonable time.",
  },
  {
    id: "changes",
    num: "10",
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. The latest version will always be published on this page with an updated effective date. Significant changes will be highlighted on this page and, where appropriate, in release notes.",
  },
  {
    id: "contact",
    num: "11",
    title: "Contact",
    body: "If you have questions about this Privacy Policy or about how your data is handled, you can reach us through the ZYRAXON AI GitHub repository (github.com/onelpawarai-X/ZYRAXON-AI) or the community channels listed on this website.",
  },
];

const DOWNLOAD_TABLE = [
  {
    row: "Website analytics",
    description:
      "Anonymous page views, device type, browser. Used only to understand site usage and improve the site.",
    stored: "On our hosting (aggregated, non-identifying)",
  },
  {
    row: "Download events",
    description:
      "Platform and version you download. Used to keep release pages accurate.",
    stored: "On our hosting (aggregated)",
  },
  {
    row: "Messages to us",
    description:
      "Anything you share when contacting support or reporting bugs.",
    stored: "Kept only as long as needed to resolve your issue",
  },
];

function PrivacyPolicyPage() {
  const [activeId, setActiveId] = useState<string | null>(SECTIONS[0].id);

  return (
    <PageShell>
      <PageHeader
        label="Legal"
        title="Privacy Policy"
        description="Your data stays on your machine. Our agent is local-first — what you do with ZYRAXON is yours."
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Tag tone="success">Local-first</Tag>
          <Tag tone="primary">No data selling</Tag>
          <Tag>Effective September 29, 2026</Tag>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { v: "Local", l: "Processing by default — no cloud account required" },
          { v: "No selling", l: "We never sell personal information or agent data" },
          { v: "Your keys", l: "External providers only when you connect them" },
        ].map((s) => (
          <Card key={s.v} className="p-5 text-center">
            <p className="text-lg font-bold tracking-tight text-primary">{s.v}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.l}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-x-auto p-6">
        <h2 className="text-[15px] font-bold text-foreground">What this policy covers</h2>
        <table className="mt-4 w-full min-w-[600px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {["Information", "How it is used", "Where it is stored"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOWNLOAD_TABLE.map((r) => (
              <tr key={r.row} className="border-b border-border/60 align-top last:border-0">
                <td className="px-3 py-3 font-semibold text-foreground">{r.row}</td>
                <td className="px-3 py-3 leading-relaxed text-muted-foreground">
                  {r.description}
                </td>
                <td className="px-3 py-3 leading-relaxed text-muted-foreground">{r.stored}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-10 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Sections
          </p>
          <ul className="mt-3 space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(s.id);
                    document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
                    activeId === s.id
                      ? "bg-primary/12 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <span className="mr-2 font-mono text-[11px] opacity-60">{s.num}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-3">
          {SECTIONS.map((s) => (
            <details
              key={s.id}
              id={`sec-${s.id}`}
              open={activeId === s.id}
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open) setActiveId(s.id);
              }}
              className="zx-glass scroll-mt-24 rounded-2xl px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 text-[15px] font-bold text-foreground">
                <span className="font-mono text-[12px] font-bold text-primary">{s.num}</span>
                {s.title}
              </summary>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{s.body}</p>
            </details>
          ))}
        </div>
      </div>

      <Card className="mt-10 p-6">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          This Privacy Policy applies to the ZYRAXON AI website and the ZYRAXON desktop agent.
          Third-party services or AI providers you connect are governed by their own policies and
          are outside our control. This document is provided for transparency and does not create
          contractual obligations beyond what is stated in the Zyraxon Sovereign License (ZSL-X).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonAnchor href="https://github.com/onelpawarai-X/ZYRAXON-AI" variant="glass" size="sm">
            Contact us on GitHub
          </ButtonAnchor>
        </div>
      </Card>
    </PageShell>
  );
}
