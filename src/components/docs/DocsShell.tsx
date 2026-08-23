import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { DOCS, DOC_GROUPS, type DocBlock } from "@/lib/docs/content";
import { X_TOOL_CATEGORIES, X_TOOL_TOTALS } from "@/lib/docs/x-tools";

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
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400">
        ZYRAXON-AI // X Tool Catalog
      </div>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
        ZYRAXON X — Complete Tool Catalog
      </h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-zinc-400">
        Every tool inside the ZYRAXON X engine, organized by category. The X engine gives the agent
        direct control over aircraft, cars, drones, rockets, boats, robots, factories, farms,
        hospitals, and entire city infrastructure — plus its MCP servers and built-in agent tools.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["X Tool Classes", String(X_TOOL_TOTALS.classes)],
          ["MCP Tools", String(X_TOOL_TOTALS.mcp)],
          ["Built-in Tools", String(X_TOOL_TOTALS.builtin)],
          ["Source Files", String(X_TOOL_TOTALS.files)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center"
          >
            <div className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text font-mono text-2xl font-black text-transparent sm:text-3xl">
              {value}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              {label}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {q ? `${shown} tools matching "${search}"` : `Showing all ${shown} tools`}
      </p>
      <a
        href="/docs/ZYRAXON-X-TOOLS.txt"
        target="_top"
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-emerald-400 transition-colors hover:bg-emerald-500/20"
      >
        ⬇ Download Full TXT Catalog
      </a>
      {cats.map((c) => (
        <section key={c.id} className="mt-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl">{c.icon}</span>
            <h2 className="text-lg font-bold text-white sm:text-xl">{c.title}</h2>
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
              {c.tools.length}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{c.blurb}</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white/[0.05]">
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-400">
                    Tool
                  </th>
                  <th className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-400">
                    What it does
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.tools.map((t, i) => (
                  <tr key={t.name} className={i % 2 ? "bg-white/[0.02]" : ""}>
                    <td className="w-1/3 whitespace-nowrap border-t border-white/[0.06] px-4 py-2 align-top font-mono text-[12px] font-semibold text-emerald-300">
                      {t.name}
                    </td>
                    <td className="border-t border-white/[0.06] px-4 py-2 align-top text-zinc-300/90">
                      {t.desc}
                    </td>
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

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**"))
      out.push(
        <strong key={k++} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>,
      );
    else if (tok.startsWith("`"))
      out.push(
        <code
          key={k++}
          className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-300"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    else {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm)
        out.push(
          <a
            key={k++}
            href={mm[2]}
            target="_top"
            className="text-cyan-400 underline underline-offset-4 hover:text-cyan-300"
          >
            {mm[1]}
          </a>,
        );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Block({ b }: { b: DocBlock }) {
  switch (b.t) {
    case "h2":
      return (
        <h2 className="mt-12 border-l-2 border-cyan-500 pl-4 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {b.text}
        </h2>
      );
    case "h3":
      return <h3 className="mt-8 text-base font-semibold text-white sm:text-lg">{b.text}</h3>;
    case "p":
      return <p className="mt-4 leading-relaxed text-zinc-300/90">{inline(b.text)}</p>;
    case "code":
      return (
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#0a0c14]">
          {b.lang ? (
            <div className="border-b border-white/[0.06] bg-white/[0.03] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {b.lang}
            </div>
          ) : null}
          <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-emerald-200/90">
            {b.code}
          </pre>
        </div>
      );
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag className={`mt-4 space-y-2 pl-1 ${b.ordered ? "list-none" : "list-none"}`}>
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-zinc-300/90">
              <span className="mt-[7px] shrink-0 font-mono text-[11px] text-cyan-500">
                {b.ordered ? String(i + 1).padStart(2, "0") : "▸"}
              </span>
              <span>{inline(it)}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-white/[0.05]">
                {b.head.map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className={i % 2 ? "bg-white/[0.02]" : ""}>
                  {r.map((c, j) => (
                    <td
                      key={j}
                      className="border-t border-white/[0.06] px-4 py-2.5 align-top text-zinc-300/90"
                    >
                      {inline(c)}
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
        info: "border-sky-500/40 bg-sky-500/[0.07] text-sky-200",
        warn: "border-amber-500/40 bg-amber-500/[0.07] text-amber-200",
        tip: "border-cyan-500/40 bg-cyan-500/[0.07] text-cyan-100",
        success: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-100",
      } as const;
      const icon = { info: "ℹ", warn: "⚠", tip: "★", success: "✓" }[b.kind];
      return (
        <div className={`mt-6 rounded-xl border px-4 py-3 ${styles[b.kind]}`}>
          <div className="flex gap-3">
            <span className="shrink-0 select-none font-mono">{icon}</span>
            <div>
              {b.title ? (
                <div className="text-xs font-bold uppercase tracking-wider">{b.title}</div>
              ) : null}
              <div className="mt-0.5 text-sm leading-relaxed opacity-90">{inline(b.text)}</div>
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
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400">
            ZYRAXON-AI // Documentation
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Official Documentation
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">
            Complete technical reference for ZYRAXON-AI — the open-source desktop AI agent with 9
            agent modes, 136+ tools, eternal memory, self-healing and real-time screen vision.
          </p>
          {DOC_GROUPS.map((g) => {
            const pages = DOCS.filter((d) => d.group === g);
            if (!pages.length) return null;
            return (
              <section key={g} className="mt-12">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
                    {g}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-cyan-500/30 to-transparent" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pages.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/docs/${p.slug}`}
                      className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/[0.06]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-white group-hover:text-cyan-300">
                          {p.title}
                        </div>
                        <span className="text-cyan-500 opacity-0 transition-opacity group-hover:opacity-100">
                          →
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm leading-relaxed text-zinc-400">{p.desc}</div>
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
          <nav className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            <a href="/docs" target="_top" className="hover:text-cyan-400">
              Docs
            </a>
            <span>/</span>
            <span className="text-cyan-400">{doc.group}</span>
          </nav>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            {doc.title}
          </h1>
          <p className="mt-3 leading-relaxed text-zinc-400">{doc.desc}</p>
          {doc.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
          <div className="mt-16 grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/docs/${prev.slug}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-cyan-500/40"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-500">
                  ← Previous
                </div>
                <div className="mt-1 font-semibold text-white">{prev.title}</div>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-right transition-colors hover:border-cyan-500/40"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-500">
                  Next →
                </div>
                <div className="mt-1 font-semibold text-white">{next.title}</div>
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
  return (
    <div
      className="min-h-screen text-zinc-200"
      style={{ background: "#06060e", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{`
        .docs-sidebar::-webkit-scrollbar{width:8px}
        .docs-sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:4px}
      `}</style>

      {/* Top bar */}
      <header
        className="sticky top-0 z-30 border-b border-white/[0.07]"
        style={{ background: "rgba(6,6,14,.85)", backdropFilter: "blur(18px)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(!open)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 lg:hidden"
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <a href="/" target="_top" className="flex items-center gap-2.5 no-underline">
              <span
                className="grid h-8 w-8 place-items-center rounded-lg font-black text-black"
                style={{ background: "linear-gradient(145deg,#00f5ff,#0080ff)" }}
              >
                ⚡
              </span>
              <span className="hidden font-mono text-xs font-bold tracking-[0.22em] text-white sm:block">
                ZYRAXON-AI
              </span>
            </a>
            <span className="ml-1 hidden rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-400 md:block">
              Documentation
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/builder/" target="_top" className="no-underline">
              <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300">
                ⚡ AI Builder
              </span>
            </a>
            <a
              href="https://github.com/onelpawarai/ZYRAXON-AI"
              target="_blank"
              rel="noreferrer"
              className="no-underline"
            >
              <span className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/30 hover:text-white">
                GitHub ↗
              </span>
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 sm:px-6">
        {/* Sidebar */}
        <aside
          className={`docs-sidebar fixed inset-y-0 left-0 z-20 mt-16 w-72 overflow-y-auto border-r border-white/[0.07] bg-[#06060e]/95 p-5 transition-transform lg:sticky lg:top-16 lg:z-0 lg:mt-0 lg:h-[calc(100vh-64px)] lg:translate-x-0 lg:border-r-0 lg:bg-transparent ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search docs…"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-cyan-500/60"
          />
          <nav className="mt-5 space-y-6">
            {DOC_GROUPS.map((g) => {
              const pages = (filtered ?? DOCS).filter((d) => d.group === g);
              if (!pages.length) return null;
              return (
                <div key={g}>
                  <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.28em] text-zinc-600">
                    {g}
                  </div>
                  <div className="space-y-0.5 border-l border-white/[0.07] pl-3">
                    {pages.map((p) => {
                      const active = p.slug === location.pathname.split("/").pop();
                      return (
                        <Link
                          key={p.slug}
                          href={`/docs/${p.slug}`}
                          onClick={() => setOpen(false)}
                          className={`block rounded-md px-2 py-1.5 text-[13px] no-underline transition-colors ${
                            active
                              ? "bg-cyan-500/10 font-medium text-cyan-300"
                              : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
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
        <main className="min-w-0 flex-1 py-10 sm:py-12">{children}</main>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600 sm:flex-row sm:px-6">
          <span>ZYRAXON-AI // All in one. Anything. Nothing is impossible.</span>
          <a href="/ecosystem" target="_top" className="no-underline hover:text-cyan-400">
            Ecosystem Marketplace
          </a>
        </div>
      </footer>
    </div>
  );
}
