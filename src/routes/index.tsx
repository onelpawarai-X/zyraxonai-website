import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { AppMarquee } from "@/components/site/AppMarquee";
import { Icon } from "@/components/site/Icon";
import { FreeTierClock } from "@/components/site/FreeTierClock";
import { useFreeTier } from "@/hooks/use-free-tier";
import { ButtonAnchor, ButtonLink, Card, Divider, Section, Tag } from "@/components/site/ui";
import { CopyButton } from "@/components/site/provider-parts";
import { CLI_COMMANDS, GITHUB_URL, HOME_DOWNLOADS, RELEASES_URL } from "@/lib/downloads";
import {
  COMPARE_COLS,
  COMPARE_ROWS,
  FEATURES,
  MODES,
  PLATFORM,
  PROVIDERS,
  SDK_FEATURES,
  STACK,
  STATS,
} from "@/lib/home-content";

const GITHUB = GITHUB_URL;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        // A slogan tells a search engine nothing about what the page is. The
        // title has to say what the product is, because that is the string a
        // person sees in the results and the one the crawler matches on.
        title:
          "ZYRAXON AI — Free Desktop AI Agent for Windows, macOS and Linux (888 Tools, 11 Modes)",
      },
      {
        name: "description",
        content:
          "The world's most advanced desktop AI agent. 888 tools across 63 categories, 11 agent modes, 108 live app integrations, screen vision and eternal memory.",
      },
      {
        name: "keywords",
        content:
          "ZYRAXON AI, desktop AI agent, free AI coding agent, open source AI agent, 888 tools, 11 agent modes, MCP integrations",
      },
      {
        property: "og:title",
        content: "ZYRAXON AI — All in One. Anything. Nothing is Impossible.",
      },
      {
        property: "og:description",
        content:
          "Desktop AI agent with 888 tools across 63 categories, 11 agent modes, screen vision and eternal memory.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ZYRAXON AI — All in One." },
      {
        name: "twitter:description",
        content: "Desktop AI agent with 888 tools, 11 agent modes and 108 live app integrations.",
      },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "ZYRAXON AI",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Windows, macOS, Linux",
          description:
            "Source-available desktop AI agent with 888 tools across 63 categories, 11 agent modes, screen vision and eternal memory.",
          url: "https://zyraxonai.lovable.app",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: HomePage,
});

const TERMINAL_LINES = [
  { p: "$", t: "zyraxon run --mode beast" },
  { p: ">", t: "Scanning workspace… 1,204 files indexed" },
  { p: ">", t: "Loading 888 tools across 63 categories" },
  { p: ">", t: "Connected: GitHub · Notion · Linear · Vercel" },
  { p: "✓", t: "Ready. What should I build?" },
];

function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--plane)]">
      <SiteHeader />
      <main className="px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-7xl">
          <div className="zx-sheet">
            <AppMarquee />
            <Hero />
            <div className="px-6 sm:px-10">
              <Divider />
              <Platform />
              <Divider />
              <Features />
              <Divider />
              <Modes />
              <Divider />
              <Models />
              <Divider />
              <Compare />
              <Divider />
              <AppsTeaser />
              <Divider />
              <Download />
              <Divider />
              <Sdk />
              <Divider />
              <Stack />
              <Divider />
              <Community />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  // One shared source for the reset clock, so the homepage and the provider
  // page can never disagree about when the pool opens.
  const { freeTier } = useFreeTier();
  return (
    <section className="relative overflow-hidden px-6 pb-10 pt-12 sm:px-10 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 zx-grid-lines opacity-[0.35]" />
      <div className="relative grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div className="zx-fade-up">
          <span className="zx-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Free &amp; source-available · Windows · macOS · Linux
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            <span className="zx-gradient-text">ZYRAXON AI</span>
            <span className="mt-3 block text-xl font-medium leading-snug text-muted-foreground sm:text-2xl">
              Everything is possible with our AI if you guide it right.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            A chatbot talks. ZYRAXON acts. It reads your files, writes your code, runs your
            commands, builds your projects and deploys your apps — with 11 agent modes, 888 tools
            across 63 categories, 108 MCP integrations, 224+ control systems, eternal memory and
            always-on screen vision.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink to="/download/zyraxon-agent" size="lg">
              <Icon name="monitor" size={17} />
              Download for desktop
            </ButtonLink>
            <ButtonLink to="/demo" size="lg" variant="glass">
              <Icon name="eye" size={17} />
              Watch the demo
            </ButtonLink>
            <ButtonAnchor href={GITHUB} size="lg" variant="glass">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7 0-.7 0-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3z" />
              </svg>
              View on GitHub
            </ButtonAnchor>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STATS.map((s) => (
              <div key={s.label} className="zx-glass rounded-xl px-3 py-2.5">
                <p className="text-lg font-bold tracking-tight text-foreground">{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="zx-float space-y-4">
          <Terminal />
          {/* The free-tier reset clock sits in the hero's right column, beside
              the copy that promises the models are free. "When will this work
              again?" is the first question a free-tier visitor has, and the
              answer belongs next to the claim it qualifies — not buried on a
              second page. It is shown in both states: an open pool says so in
              green, which is the proof that the free tier is live, and a spent
              one counts down to the moment it opens. */}
          {freeTier && <FreeTierClock status={freeTier} compact />}
        </div>
      </div>

      {/* The command line sits directly under the hero, above the fold on a
          laptop. Someone who arrives already knowing they want the CLI should
          never have to scroll past the marketing to find out how to get it. */}
      <CliPanel />
    </section>
  );
}

/** The install-one-liner block, with a platform switcher. */
function CliPanel() {
  // Only the short list: the ARM and musl builds are a click away on the
  // download page, and six tabs here would bury the common case.
  const tabs = CLI_COMMANDS.filter((c) =>
    ["macOS · Apple Silicon", "Linux · x64", "Windows · PowerShell"].includes(c.label),
  );
  const [active, setActive] = useState(0);
  const current = tabs[active];

  return (
    <div className="mx-auto mt-10 max-w-4xl">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="zx-glass grid h-9 w-9 place-items-center rounded-lg text-primary">
            <Icon name="code" size={17} />
          </span>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Install the CLI
          </h2>
          <span className="text-[12.5px] text-muted-foreground">one line, newest release</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {tabs.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setActive(i)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  i === active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground">
            <code>{current.code}</code>
          </pre>
          <span className="shrink-0 pt-2">
            <CopyButton text={current.code} label="copy" />
          </span>
        </div>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          ARM64, musl and Windows-on-ARM builds, plus the desktop installers, are on the{" "}
          <ButtonLink to="/download/zyraxon-agent" className="px-0 underline">
            download page
          </ButtonLink>
          .
        </p>
      </Card>
    </div>
  );
}

function Terminal() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setVisible((v) => (v >= TERMINAL_LINES.length ? 0 : v + 1));
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="zx-glass-strong overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          zyraxon agent
        </span>
      </div>
      <div className="space-y-2.5 px-5 py-5 font-mono text-[12.5px] leading-relaxed">
        {TERMINAL_LINES.map((line, i) => (
          <div
            key={line.t}
            className={`flex gap-2.5 transition-opacity duration-300 ${
              i < visible ? "opacity-100" : "opacity-25"
            }`}
          >
            <span
              className={
                line.p === "✓"
                  ? "text-emerald-500"
                  : line.p === "$"
                    ? "text-primary"
                    : "text-muted-foreground"
              }
            >
              {line.p}
            </span>
            <span className="text-foreground">{line.t}</span>
          </div>
        ))}
        <div className="flex gap-2.5">
          <span className="text-primary">$</span>
          <span className="inline-block h-4 w-2 animate-pulse bg-foreground/70" />
        </div>
      </div>
    </div>
  );
}

function Platform() {
  return (
    <Section
      label="One platform"
      title="Everything ZYRAXON, in one desktop app"
      description="The agent and its editor ship together, so you never stitch a workflow out of five separate tools."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORM.map((p) => (
          <Card key={p.title} hover className="p-6">
            <span className="zx-glass grid h-11 w-11 place-items-center rounded-xl text-primary">
              <Icon name={p.icon} size={21} />
            </span>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{p.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{p.body}</p>
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-primary">
              {p.meta}
            </p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section
      label="Capabilities"
      title="Built for power users"
      description="Everything you need to build, ship and run serious work from a single desktop app."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Card key={f.title} hover className="p-5">
            <span className="zx-glass grid h-10 w-10 place-items-center rounded-xl text-primary">
              <Icon name={f.icon} size={19} />
            </span>
            <h3 className="mt-3.5 text-[15px] font-semibold tracking-tight text-foreground">
              {f.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Modes() {
  const [active, setActive] = useState(0);
  return (
    <Section
      label="Ten agent modes"
      title="From read-only planning to unstoppable"
      description="Each mode rewrites the system prompt, the toolset, the permissions and the behaviour. Select one to see what it unlocks."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_1.1fr]">
        <div className="flex flex-wrap gap-2 lg:content-start">
          {MODES.map((m, i) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setActive(i)}
              className={`zx-chip rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                active === i ? "bg-primary/12 text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="mr-1.5 font-mono text-[11px] opacity-60">{m.n}</span>
              {m.name}
            </button>
          ))}
        </div>
        <Card className="p-6">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold text-primary/30">{MODES[active].n}</span>
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              {MODES[active].name}
            </h3>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            {MODES[active].body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tag tone="primary">System prompt rewrite</Tag>
            <Tag>Toolset swap</Tag>
            <Tag>Permission scope</Tag>
          </div>
        </Card>
      </div>
    </Section>
  );
}

function Models() {
  return (
    <Section
      label="Bring your own model"
      title="25+ providers, or run locally"
      description="Connect to a hosted provider or keep everything on your machine with Ollama. Switch providers per session."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((p) => (
          <div
            key={p.name}
            className="zx-glass flex items-center justify-between rounded-2xl px-5 py-4"
          >
            <div>
              <p className="text-[15px] font-semibold text-foreground">{p.name}</p>
              <p className="text-[12px] text-muted-foreground">{p.vendor}</p>
            </div>
            <Icon name="spark" size={18} className="text-primary" />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Compare() {
  return (
    <Section
      label="Comparison"
      title="Why ZYRAXON"
      description="A side-by-side look at what a desktop agent can do that a chat window cannot."
    >
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-4 text-left text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                Feature
              </th>
              {COMPARE_COLS.map((c) => (
                <th
                  key={c.name}
                  className={`px-5 py-4 text-center text-[13px] font-bold ${
                    c.highlight ? "text-primary" : "text-foreground"
                  }`}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row, i) => (
              <tr key={row} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3.5 text-[13px] font-medium text-foreground">{row}</td>
                {COMPARE_COLS.map((c) => (
                  <td key={c.name} className="px-5 py-3.5 text-center">
                    {c.hits[i] ? (
                      <span
                        className={`inline-grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
                          c.highlight
                            ? "bg-primary/15 text-primary"
                            : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        ✓
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

function AppsTeaser() {
  return (
    <Section
      label="Integrations"
      title="Your whole stack, connected"
      description="108 live MCP integrations across 27 categories. Each endpoint was verified against its live server before it was listed."
    >
      <Card className="relative overflow-hidden p-8">
        <div className="pointer-events-none absolute inset-0 zx-grid-lines opacity-30" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Browse every connected app
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Filter by category or auth tier, see exactly what each integration needs, and connect
              it from the agent. Browser sign-in, token, open and local tiers — no surprises.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Tag tone="primary">Browser sign-in</Tag>
              <Tag>Needs a token</Tag>
              <Tag tone="success">No sign-in</Tag>
              <Tag>Runs locally</Tag>
            </div>
          </div>
          <ButtonLink to="/apps" size="lg">
            <Icon name="plug" size={17} />
            Open the app directory
          </ButtonLink>
        </div>
      </Card>
    </Section>
  );
}

function Download() {
  return (
    <Section
      label="Download"
      title="Get ZYRAXON Agent"
      description="Free and source-available. Every button saves the newest build straight from the release — no page in between."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {HOME_DOWNLOADS.map((d) => (
          <Card key={d.os} hover className="flex flex-col p-6 text-center">
            <span className="zx-glass mx-auto grid h-12 w-12 place-items-center rounded-xl text-primary">
              <Icon name="monitor" size={22} />
            </span>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{d.os}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">{d.detail}</p>
            <div className="mt-auto grid gap-2 pt-5">
              <ButtonAnchor
                href={`/api/download/${d.key}`}
                external={false}
                variant="glass"
                size="sm"
              >
                Desktop app {d.ext}
              </ButtonAnchor>
              <ButtonAnchor
                href={`/api/download/${d.cliKey}`}
                external={false}
                variant="outline"
                size="sm"
              >
                CLI {d.cliExt}
              </ButtonAnchor>
            </div>
          </Card>
        ))}
      </div>

      {/* The one-liner belongs beside the buttons: anyone who would rather paste
          a command than run an installer should not have to open another page to
          find it. */}
      <Card className="mt-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="zx-glass grid h-9 w-9 place-items-center rounded-lg text-primary">
            <Icon name="code" size={17} />
          </span>
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            Or install the CLI in one line
          </h3>
          <CopyButton text={CLI_COMMANDS[0].code} label="copy" />
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground">
          <code>{CLI_COMMANDS[0].code}</code>
        </pre>
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          macOS, Linux, Windows PowerShell and ARM builds — all on the{" "}
          <ButtonLink to="/download/zyraxon-agent" className="px-0 underline">
            download page
          </ButtonLink>
          .
        </p>
      </Card>

      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink to="/download/zyraxon-agent" size="sm">
          All downloads
        </ButtonLink>
        <ButtonAnchor href={RELEASES_URL} variant="glass" size="sm">
          Release notes
        </ButtonAnchor>
        <ButtonLink to="/packages" variant="glass" size="sm">
          12 NPM packages
        </ButtonLink>
      </div>
    </Section>
  );
}

function Sdk() {
  const [copied, setCopied] = useState(false);
  const cmd = "npm install @zyraxon-ai/sdk";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Section
      label="SDK"
      title="Build with the ZYRAXON SDK"
      description="An official TypeScript SDK for AI-powered applications, published as 12 packages on npm."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="flex flex-col justify-between p-6">
          <div className="zx-glass flex items-center gap-3 rounded-xl px-4 py-3 font-mono text-[13px]">
            <span className="text-primary">$</span>
            <code className="min-w-0 flex-1 truncate text-foreground">{cmd}</code>
            <button
              type="button"
              onClick={copy}
              className="zx-chip rounded-lg px-2.5 py-1 text-[11px] font-semibold text-foreground"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-5">
            <ButtonLink to="/packages" variant="glass" size="sm">
              See all packages
            </ButtonLink>
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {SDK_FEATURES.map((f) => (
            <Card key={f.title} hover className="p-5">
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Stack() {
  return (
    <Section
      label="Under the hood"
      title="Powered by a modern stack"
      description="Fast, lean and built for the desktop era."
    >
      <div className="flex flex-wrap gap-2.5">
        {STACK.map((s) => (
          <span
            key={s}
            className="zx-chip rounded-full px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </Section>
  );
}

function Community() {
  return (
    <Section
      label="Community"
      title="Join the people building with ZYRAXON"
      description="Create a public profile, share your work and links, and browse everyone in the roster. Questions and feedback become real GitHub issues."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card hover className="flex flex-col p-6">
          <span className="zx-glass grid h-11 w-11 place-items-center rounded-xl text-primary">
            <Icon name="users" size={20} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
            Community profiles
          </h3>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            Add a photo, role, country, skills and links, then get your own public profile page.
          </p>
          <div className="mt-4">
            <ButtonLink to="/community-art" variant="glass" size="sm">
              Join the roster
            </ButtonLink>
          </div>
        </Card>
        <Card hover className="flex flex-col p-6">
          <span className="zx-glass grid h-11 w-11 place-items-center rounded-xl text-primary">
            <Icon name="message" size={20} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
            Desktop feedback
          </h3>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            Send feedback straight to the team by email, or open a tracked GitHub issue.
          </p>
          <div className="mt-4">
            <ButtonLink to="/desktop-feedback" variant="glass" size="sm">
              Send feedback
            </ButtonLink>
          </div>
        </Card>
        <Card hover className="flex flex-col p-6">
          <span className="zx-glass grid h-11 w-11 place-items-center rounded-xl text-primary">
            <Icon name="book" size={20} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
            Documentation
          </h3>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            The full technical reference: tools, modes, memory, vision and build guides.
          </p>
          <div className="mt-4">
            <ButtonLink to="/docs" variant="glass" size="sm">
              Read the docs
            </ButtonLink>
          </div>
        </Card>
      </div>
    </Section>
  );
}
