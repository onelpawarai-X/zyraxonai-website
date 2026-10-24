import { Link, useRouterState } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { inlineMarkdown } from "@/lib/inline-markdown";
import { DOCS, DOC_GROUPS, type DocBlock } from "@/lib/docs/content";
import { X_TOOL_CATEGORIES, X_TOOL_TOTALS } from "@/lib/docs/x-tools";
import { StarGatePanel } from "@/components/site/StarGatePanel";

function XToolsCatalog({ search }: { search: string }) {
  const q = search.trim().toLowerCase();
  const cats = X_TOOL_CATEGORIES.map((c) => ({
    ...c,
    tools: q
      ? c.tools.filter((t) => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q))
      : c.tools,
  })).filter((c) => !q || c.tools.length > 0);
  const shown = cats.reduce((n, c) => n + c.tools.length, 0);
  return (
    <article className="mx-auto max-w-5xl pb-20">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        ZYRAXON-AI // X Tool Catalog
      </div>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
        ZYRAXON X — Complete Tool Catalog
      </h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        Every tool inside the ZYRAXON X engine, organized by category. The X engine gives the agent
        direct control over aircraft, cars, drones, rockets, boats, robots, factories, farms,
        hospitals, and entire city infrastructure — plus its MCP servers and built-in agent tools.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total Tools", String(X_TOOL_TOTALS.tools)],
          ["MCP Apps", String(X_TOOL_TOTALS.mcp)],
          ["Control Systems", String(X_TOOL_TOTALS.classes)],
          ["Source Files", String(X_TOOL_TOTALS.files)],
        ].map(([label, value]) => (
          <div key={label} className="p-4 text-center">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text font-mono text-2xl font-black text-transparent sm:text-3xl">
              {value}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {q ? `${shown} tools matching "${search}"` : `Showing all ${shown} tools`}
      </p>
      <a
        href="/docs/ZYRAXON-X-TOOLS.txt"
        target="_top"
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/15"
      >
        Download Full TXT Catalog
      </a>
      {cats.map((c) => (
        <section key={c.id} className="mt-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl">{c.icon}</span>
            <h2 className="text-lg font-bold text-foreground sm:text-xl">{c.title}</h2>
            <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
              {c.tools.length}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.blurb}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                    Tool
                  </th>
                  <th className="pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                    What it does
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.tools.map((t) => (
                  <tr key={t.name} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap py-2.5 pr-4 align-top font-mono text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {t.name}
                    </td>
                    <td className="py-2.5 align-top text-muted-foreground">{t.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </article>
  );
}

function Block({ b }: { b: DocBlock }) {
  switch (b.t) {
    case "h2":
      return (
        <h2 className="mt-12 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {b.text}
        </h2>
      );
    case "h3":
      return <h3 className="mt-8 text-base font-semibold text-foreground sm:text-lg">{b.text}</h3>;
    case "p":
      return <p className="mt-4 leading-relaxed text-muted-foreground">{inlineMarkdown(b.text)}</p>;
    case "code":
      return (
        <div className="mt-5 overflow-hidden rounded-lg bg-[#0a0a0f]">
          {b.lang ? (
            <div className="border-b border-gray-800 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {b.lang}
            </div>
          ) : null}
          <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-green-300">
            {b.code}
          </pre>
        </div>
      );
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag className={`mt-4 space-y-2 ${b.ordered ? "list-none" : "list-none"}`}>
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-muted-foreground">
              <span className="mt-[7px] shrink-0 font-mono text-[11px] text-blue-500">
                {b.ordered ? String(i + 1).padStart(2, "0") : "\u25B8"}
              </span>
              <span>{inlineMarkdown(it)}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                {b.head.map((h, i) => (
                  <th
                    key={i}
                    className="pb-2 pr-4 font-mono text-[10px] uppercase tracking-[0.16em] text-primary"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="py-2.5 pr-4 align-top text-muted-foreground">
                      {inlineMarkdown(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "note": {
      const styles = {
        info: "border-primary/60 text-primary",
        warn: "border-amber-400 text-amber-800",
        tip: "border-primary/60 text-primary",
        success: "border-emerald-500 text-emerald-600 dark:text-emerald-400",
      } as const;
      const icon = { info: "\u2139", warn: "\u26A0", tip: "\u2605", success: "\u2713" }[b.kind];
      return (
        <div className={`mt-6 border-l-4 py-3 pl-4 ${styles[b.kind]}`}>
          <div className="flex gap-3">
            <span className="shrink-0 select-none font-mono text-lg">{icon}</span>
            <div>
              {b.title ? (
                <div className="text-xs font-bold uppercase tracking-wider">{b.title}</div>
              ) : null}
              <div className="mt-0.5 text-sm leading-relaxed opacity-90">
                {inlineMarkdown(b.text)}
              </div>
            </div>
          </div>
        </div>
      );
    }
  }
}

export default function DocsShell({ slug }: { slug?: string }) {
  const doc = useMemo(() => {
    if (!slug || !DOCS.some((d) => d.slug === slug)) return undefined;
    return DOCS.find((d) => d.slug === slug);
  }, [slug]);
  const idx = doc ? DOCS.findIndex((d) => d.slug === doc.slug) : -1;
  const prev = idx > 0 ? DOCS[idx - 1] : undefined;
  const next = idx >= 0 && idx < DOCS.length - 1 ? DOCS[idx + 1] : undefined;
  const [q, setQ] = useState("");
  const filtered = q.trim()
    ? DOCS.filter(
        (d) =>
          d.title.toLowerCase().includes(q.toLowerCase()) ||
          d.desc.toLowerCase().includes(q.toLowerCase()),
      )
    : null;

  if (!doc) {
    return (
      <DocsShellFrame search={q} setSearch={setQ} filtered={filtered}>
        <div className="mx-auto max-w-3xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            ZYRAXON-AI // Documentation
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-5xl">
            Official Documentation
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Complete technical reference for ZYRAXON-AI — the source-available desktop AI agent with
            11 agent modes, 888 tools across 63 categories, 108 MCP integrations, eternal memory,
            self-healing and real-time screen vision.
          </p>
          {DOC_GROUPS.map((g) => {
            const pages = DOCS.filter((d) => d.group === g);
            if (!pages.length) return null;
            return (
              <section key={g} className="mt-12">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {g}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pages.map((p) => (
                    <Link
                      key={p.slug}
                      to="/docs/$slug"
                      params={{ slug: p.slug }}
                      className="group border-b border-border/60 py-4 no-underline transition-colors hover:border-blue-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-foreground group-hover:text-primary">
                          {p.title}
                        </div>
                        <span className="text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
                          &#8594;
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {p.desc}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DocsShellFrame>
    );
  }

  return (
    <DocsShellFrame search={q} setSearch={setQ} filtered={filtered}>
      {doc.slug === "x-tools" ? (
        <XToolsCatalog search={q} />
      ) : (
        <article className="mx-auto max-w-3xl pb-20">
          <nav className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <a href="/docs" target="_top" className="hover:text-primary">
              Docs
            </a>
            <span>/</span>
            <span className="text-primary">{doc.group}</span>
          </nav>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            {doc.title}
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">{doc.desc}</p>
          {/* Every page in the provider guide carries the gate, because a
              reader can land on any of them from a search result. The live
              count is what makes it a status rather than a disclaimer. */}
          {doc.group === "ZYRAXON Provider" && (
            <div className="mt-6">
              <StarGatePanel compact />
            </div>
          )}
          {doc.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
          <div className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                to="/docs/$slug"
                params={{ slug: prev.slug }}
                className="border-b border-border/60 py-4 no-underline transition-colors hover:border-blue-300"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                  &#8592; Previous
                </div>
                <div className="mt-1 font-semibold text-foreground">{prev.title}</div>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to="/docs/$slug"
                params={{ slug: next.slug }}
                className="border-b border-border/60 py-4 text-right no-underline transition-colors hover:border-blue-300"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                  Next &#8594;
                </div>
                <div className="mt-1 font-semibold text-foreground">{next.title}</div>
              </Link>
            ) : null}
          </div>
        </article>
      )}
    </DocsShellFrame>
  );
}

function DocsShellFrame({
  children,
  search,
  setSearch,
  filtered,
}: {
  children: ReactNode;
  search: string;
  setSearch: (v: string) => void;
  filtered: typeof DOCS | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div
      className="min-h-screen bg-[var(--plane)] text-foreground"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{`
        .docs-sidebar::-webkit-scrollbar{width:6px}
        .docs-sidebar::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
        .docs-sidebar::-webkit-scrollbar-thumb:hover{background:#9ca3af}
      `}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-[var(--plane)]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(!open)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
              aria-label="Toggle navigation"
            >
              &#9776;
            </button>
            <a href="/" target="_top" className="flex items-center gap-2.5 no-underline">
              <span
                className="grid h-8 w-8 place-items-center rounded-lg font-black text-white"
                style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
              >
                Z
              </span>
              <span className="hidden text-sm font-bold tracking-tight text-foreground sm:block">
                ZYRAXON-AI
              </span>
            </a>
            <span className="ml-1 hidden rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-primary md:block">
              Documentation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/ecosystem" target="_top" className="no-underline">
              <span className="rounded-lg border border-border bg-[var(--plane)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-blue-300 hover:text-primary">
                Ecosystem
              </span>
            </a>
            <a
              href="https://github.com/onelpawarai-X/ZYRAXON-AI"
              target="_blank"
              rel="noreferrer"
              className="no-underline"
            >
              <span className="rounded-lg border border-border bg-[var(--plane)] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground">
                GitHub &#8599;
              </span>
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-0 px-0 sm:px-0">
        {/* Sidebar */}
        <aside
          className={`docs-sidebar zx-glass-strong fixed inset-y-0 left-0 z-20 mt-20 w-72 overflow-y-auto p-5 transition-transform lg:sticky lg:top-24 lg:z-0 lg:mt-0 lg:h-[calc(100vh-7rem)] lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search docs..."
            className="w-full rounded-lg border border-border bg-foreground/5 px-3 py-2 text-sm text-foreground placeholder-gray-400 outline-none transition-colors focus:border-primary/60 focus:bg-[var(--plane)] focus:ring-2 focus:ring-blue-100"
          />
          <Link
            to="/docs/$slug"
            params={{ slug: "provider-overview" }}
            onClick={() => setOpen(false)}
            className="mt-4 flex items-center justify-between rounded-xl px-3.5 py-2.5 no-underline transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}
          >
            <span className="flex flex-col">
              <span className="text-[13px] font-bold text-white">Provider</span>
              <span className="text-[10px] font-medium text-white/80">
                Ten models · one endpoint
              </span>
            </span>
            <span className="text-white/90">&#8594;</span>
          </Link>
          <nav className="mt-5 space-y-6">
            {DOC_GROUPS.map((g) => {
              const pages = (filtered ?? DOCS).filter((d) => d.group === g);
              if (!pages.length) return null;
              return (
                <div key={g}>
                  <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
                    {g}
                  </div>
                  <div className="space-y-0.5 border-l border-border pl-3">
                    {pages.map((p) => {
                      const active = p.slug === pathname.split("/").pop();
                      return (
                        <Link
                          key={p.slug}
                          to="/docs/$slug"
                          params={{ slug: p.slug }}
                          onClick={() => setOpen(false)}
                          className={`block rounded-md px-2 py-1.5 text-[13px] no-underline transition-colors ${
                            active
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          {p.title}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 py-10 sm:py-12 px-6 sm:px-8">{children}</main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:flex-row sm:px-6">
          <span>ZYRAXON-AI // All in one. Anything. Nothing is impossible.</span>
          <div className="flex gap-6">
            <a href="/ecosystem" target="_top" className="no-underline hover:text-primary">
              Ecosystem Marketplace
            </a>
            <a href="/faq" target="_top" className="no-underline hover:text-primary">
              FAQ
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
