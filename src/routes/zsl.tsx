import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Divider, Section, StatTile, Tag } from "@/components/site/ui";
import { Icon } from "@/components/site/Icon";

export const Route = createFileRoute("/zsl")({
  head: () => ({
    meta: [
      { title: "ZSL — Zyraxon Sovereign License" },
      {
        name: "description",
        content:
          "The Zyraxon Sovereign License — an enterprise-grade open license for the AI era. Commercial freedom, patent protection, identity safety.",
      },
      {
        name: "keywords",
        content: "Zyraxon Sovereign License, ZSL-X, source available license, AI license",
      },
      { property: "og:title", content: "ZSL — Zyraxon Sovereign License" },
      {
        property: "og:description",
        content:
          "The Zyraxon Sovereign License — an enterprise-grade open license for the AI era. Commercial freedom, patent protection, identity safety.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/zsl" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ZSL — Zyraxon Sovereign License" },
      {
        name: "twitter:description",
        content: "The Zyraxon Sovereign License — an enterprise-grade open license for the AI era.",
      },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/zsl" }],
  }),
  component: ZSLPage,
});

const COMPARISON = [
  { feature: "Commercial use", zsl: true, mit: true, apache: true, gpl: "Copyleft" },
  {
    feature: "Enterprise (50+ employees)",
    zsl: "Explicit",
    mit: "Implied",
    apache: "Implied",
    gpl: "Implied",
  },
  { feature: "Modification", zsl: true, mit: true, apache: true, gpl: true },
  { feature: "Redistribution", zsl: true, mit: true, apache: true, gpl: "Copyleft" },
  { feature: "Patent grant", zsl: true, mit: false, apache: true, gpl: true },
  { feature: "Attribution required", zsl: true, mit: true, apache: true, gpl: true },
  { feature: "Identity protection", zsl: true, mit: false, apache: false, gpl: false },
  { feature: "Auto-transition to next-gen", zsl: true, mit: false, apache: false, gpl: false },
  { feature: "Selling / rebranding prohibited", zsl: true, mit: false, apache: false, gpl: false },
  { feature: "Contributor protection", zsl: true, mit: false, apache: "Basic", gpl: "Basic" },
  { feature: "Security disclosure framework", zsl: true, mit: false, apache: false, gpl: false },
  { feature: "Patent retaliation clause", zsl: true, mit: false, apache: true, gpl: true },
];

const FAQ = [
  {
    q: "Can I use ZSL for my commercial product?",
    a: "Yes. ZSL-X grants full commercial rights. No royalties, no fees, no permission needed. Enterprise use is explicitly covered.",
  },
  {
    q: "Do I need to open-source my derivative?",
    a: "No. ZSL is not copyleft. You can keep your modifications private and proprietary.",
  },
  {
    q: "Can I use 'ZYRAXON' in my product name?",
    a: "You can use descriptive references like 'Based on ZYRAXON AI' but cannot use 'ZYRAXON' branding in a way that implies your product is the official release.",
  },
  {
    q: "What happens on January 1, 2028?",
    a: "All software under ZSL-X automatically transitions to MEKRA-X v2.0.0. No action needed. Software obtained before 2028 can stay under ZSL-X if you prefer.",
  },
  {
    q: "What if I breach the license?",
    a: "Both editions terminate automatically on a material breach (Section 12) — for example selling the software or republishing a modified version as your own product. On termination you must stop distributing the software.",
  },
  {
    q: "Is there a patent risk?",
    a: "ZSL includes a patent grant from contributors. If you sue for patent infringement, your license terminates (patent retaliation clause).",
  },
  {
    q: "Can I contribute code?",
    a: "Yes. Contributors retain ownership but grant a royalty-free license for their submissions.",
  },
  {
    q: "How do I report a security vulnerability?",
    a: "Report privately. You'll get a 72-hour acknowledgment and 14-day remediation timeline. You can disclose publicly after 90 days or after a fix.",
  },
];

const PROJECTS_USING_ZSL = [
  {
    name: "ZYRAXON-AI",
    desc: "Main AI platform with 888 tools across 63 categories and 108 MCP integrations",
    repo: "onelpawarai-X/ZYRAXON-AI",
    color: "#2563eb",
  },
];

const TIMELINE = [
  {
    year: "2026",
    event: "ZSL-X v2.0.0 released",
    desc: "Active license for all ZYRAXON projects",
    active: true,
  },
  {
    year: "2028",
    event: "MEKRA-X v2.0.0 auto-activates",
    desc: "The successor edition — the strictest of the license family",
    active: false,
  },
  {
    year: "2030+",
    event: "NEXUS-X transition available",
    desc: "Future-proof path with 180-day notice period",
    active: false,
  },
];

function Mark({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="mx-auto grid h-5 w-5 place-items-center rounded-full bg-emerald-500/12 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
        ✓
      </span>
    ) : (
      <span className="text-muted-foreground/40">—</span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-500/14 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
      {value}
    </span>
  );
}

const WHY = [
  {
    title: "Commercial freedom",
    body: "Use it for any purpose — personal, commercial, enterprise, government or education. No royalties, no fees, no permission needed.",
    icon: "bolt",
  },
  {
    title: "Patent protection",
    body: "Contributors grant a patent licence for their contributions, and the retaliation clause keeps everyone honest.",
    icon: "shield",
  },
  {
    title: "Identity safety",
    body: "Others can fork and modify freely, but they cannot impersonate the official release or rebrand it as their own product.",
    icon: "users",
  },
];

const ZSL_PERKS = [
  "Full commercial rights",
  "Modification and fork rights",
  "Redistribution with attribution",
  "Patent grant from contributors",
  "Project identity protection",
  "Auto-transitions to MEKRA-X in 2028",
];

const MEKRA_PERKS = [
  "Everything in ZSL-X, plus:",
  "Explicit paid-tier protection",
  "Clear line for paid products built around ZYRAXON",
  "Contributor ownership with patent grant",
  "Private security disclosure encouraged",
  "Same automatic termination for resellers",
];

const ADOPTION = [
  {
    title: "Reference in your project",
    desc: "Add a one-line reference to your LICENSE file or package.json.",
    code: "Licensed under the Zyraxon Sovereign License\n— X Edition (ZSL-X v2.0.0)\nSee https://github.com/onelpawarai-X/ZSL",
  },
  {
    title: "Include the full licence",
    desc: "Copy ZSL-X-LICENSE into your project root as your LICENSE file.",
    code: "curl -o LICENSE https://raw.githubusercontent.com/\nonelpawarai-X/ZSL/main/ZSL-X-LICENSE",
  },
  {
    title: "npm / package.json",
    desc: "Reference the licence file in your package manifest.",
    code: '{\n  "license": "SEE LICENSE IN LICENSE",\n  "licenseFile": "LICENSE"\n}',
  },
];

const ATTRIBUTION = `This software is based on [Project Name],
originally created by onelpawarai.
Modifications have been made.

Licensed under the Zyraxon Sovereign License
— X Edition (ZSL-X v2.0.0).`;

function ZSLPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<"zsl-x" | "mekra-x">("zsl-x");

  return (
    <PageShell>
      <PageHeader
        label="Legal"
        title="Zyraxon Sovereign License"
        description="An enterprise-grade open licence for the AI era: full commercial freedom, patent protection, identity safety and future-proof transitions."
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Tag tone="primary">ZSL-X v2.0.0 · active 2026–2028</Tag>
          <Tag tone="success">Commercial use allowed</Tag>
          <Tag>Not copyleft</Tag>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonAnchor href="#licences" external={false} size="md">
            Read the licence
          </ButtonAnchor>
          <ButtonAnchor href="https://github.com/onelpawarai-X/ZSL" variant="glass" size="md">
            View on GitHub
          </ButtonAnchor>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile value="100%" label="Commercial freedom" />
        <StatTile value="Patent" label="Grant included" />
        <StatTile value="2" label="Editions" />
        <StatTile value="2028" label="Auto-transition" />
      </div>

      <Section className="mt-12" label="Why ZSL" title="Built for the AI era">
        <div className="grid gap-4 sm:grid-cols-3">
          {WHY.map((c) => (
            <Card key={c.title} hover className="p-6">
              <span className="zx-glass grid h-11 w-11 place-items-center rounded-xl text-primary">
                <Icon name={c.icon} size={20} />
              </span>
              <h3 className="mt-4 text-[15px] font-bold text-foreground">{c.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Divider />

      <Section
        label="Comparison"
        title="How ZSL compares"
        description="MIT freedom, Apache patent protection, identity safety and a future-proof transition, in one licence."
      >
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Feature
                </th>
                <th className="px-5 py-3.5 text-center text-[13px] font-bold text-primary">
                  ZSL-X
                </th>
                {["MIT", "Apache 2.0", "GPL-3.0"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-center text-[13px] font-semibold text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">{row.feature}</td>
                  {[row.zsl, row.mit, row.apache, row.gpl].map((v, i) => (
                    <td key={i} className="px-5 py-3 text-center">
                      <Mark value={v as boolean | string} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Divider />

      <Section
        id="licences"
        label="The licences"
        title="Two editions, one vision"
        description="ZSL-X is active today. MEKRA-X is its successor and activates automatically."
      >
        <div className="mb-5 inline-flex gap-1.5 rounded-full p-1.5 zx-glass">
          {(["zsl-x", "mekra-x"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                activeTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "zsl-x" ? "ZSL-X v2.0.0" : "MEKRA-X v2.0.0"}
            </button>
          ))}
        </div>

        <Card className="relative overflow-hidden p-7">
          <span
            className={`absolute inset-x-0 top-0 h-1 ${
              activeTab === "zsl-x"
                ? "bg-gradient-to-r from-primary to-cyan-400"
                : "bg-gradient-to-r from-amber-400 to-orange-500"
            }`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Tag tone={activeTab === "zsl-x" ? "primary" : "warn"}>
              {activeTab === "zsl-x" ? "Active" : "Successor"}
            </Tag>
            <span className="text-[13px] text-muted-foreground">
              {activeTab === "zsl-x" ? "Valid 2026–2028" : "Auto-activates 1 January 2028"}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-bold tracking-tight text-foreground">
            {activeTab === "zsl-x" ? "ZSL-X v2.0.0" : "MEKRA-X v2.0.0"}
          </h3>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
            {activeTab === "zsl-x"
              ? "The active licence for all ZYRAXON projects. Grants full commercial, modification and redistribution rights while protecting project identity and origin."
              : "The successor edition and the strictest of the licence family. It keeps the same generous core and protections, with clearer wording on tier protection and paid products built around the software."}
          </p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {(activeTab === "zsl-x" ? ZSL_PERKS : MEKRA_PERKS).map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  ✓
                </span>
                <span className="text-[13px] text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonAnchor
              href={`https://github.com/onelpawarai-X/ZSL/blob/main/${
                activeTab === "zsl-x" ? "ZSL-X-LICENSE" : "MEKRA-X-LICENSE"
              }`}
              size="sm"
            >
              Read full text
            </ButtonAnchor>
            <ButtonAnchor href="https://github.com/onelpawarai-X/ZSL" variant="glass" size="sm">
              View on GitHub
            </ButtonAnchor>
          </div>
        </Card>
      </Section>

      <Divider />

      <Section label="Timeline" title="Licence timeline">
        <Card className="p-7">
          <div className="relative pl-8">
            <span className="absolute bottom-2 left-[11px] top-2 w-px bg-border" />
            {TIMELINE.map((t, i) => (
              <div key={t.year} className={i < TIMELINE.length - 1 ? "relative mb-8" : "relative"}>
                <span
                  className={`absolute -left-8 top-1 grid h-6 w-6 place-items-center rounded-full border-2 ${
                    t.active ? "border-primary bg-primary" : "border-border bg-transparent"
                  }`}
                >
                  {t.active && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[14px] font-bold ${t.active ? "text-primary" : "text-foreground"}`}
                  >
                    {t.year}
                  </span>
                  <span className="text-[14px] font-semibold text-foreground">{t.event}</span>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Divider />

      <Section
        label="Adoption"
        title="How to use ZSL"
        description="Three ways to adopt the Zyraxon Sovereign Licence in your own project."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {ADOPTION.map((w) => (
            <Card key={w.title} className="flex flex-col p-6">
              <h3 className="text-[15px] font-bold text-foreground">{w.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{w.desc}</p>
              <pre className="zx-glass mt-4 overflow-auto rounded-xl p-3.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {w.code}
              </pre>
            </Card>
          ))}
        </div>
      </Section>

      <Divider />

      <Section
        label="Adopters"
        title="Projects using ZSL"
        description="All official ZYRAXON projects are licensed under ZSL."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS_USING_ZSL.map((p) => (
            <a
              key={p.name}
              href={`https://github.com/${p.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="zx-glass zx-sheen rounded-2xl p-5 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                <span className="text-[15px] font-bold text-foreground">{p.name}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{p.desc}</p>
              <div className="mt-3">
                <Tag tone="primary">ZSL-X v2.0.0</Tag>
              </div>
            </a>
          ))}
        </div>
      </Section>

      <Divider />

      <Section label="FAQ" title="Licence questions">
        <div className="grid gap-3">
          {FAQ.map((f, i) => (
            <details
              key={f.q}
              open={openFaq === i}
              onToggle={(e) => {
                if ((e.target as HTMLDetailsElement).open) setOpenFaq(i);
              }}
              className="zx-glass rounded-2xl px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] font-semibold text-foreground">
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
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Divider />

      <Section
        label="Attribution"
        title="Attribution template"
        description="Any redistribution must include the following attribution."
      >
        <Card className="p-6">
          <pre className="overflow-auto whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-muted-foreground">
            {ATTRIBUTION}
          </pre>
        </Card>
      </Section>
    </PageShell>
  );
}
