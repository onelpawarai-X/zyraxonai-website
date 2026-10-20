import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { ButtonLink, Card, Tag } from "@/components/site/ui";

type Share = {
  id: string;
  sessionID: string;
  timeCreated: string;
  timeUpdated: string;
  session: Record<string, unknown> | null;
  messages: Record<string, unknown>[];
  parts: Record<string, unknown>[];
  diffs: Record<string, unknown>[];
  models: Record<string, unknown>[];
};

export const Route = createFileRoute("/share/$id")({
  head: ({ params }) => {
    const title = `ZYRAXON Shared Session — ${params.id}`;
    const description =
      "A published ZYRAXON AI coding session: prompts, AI responses, code and file diffs.";
    const url = `https://zyraxonai.lovable.app/share/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: title,
            description,
            url,
            author: { "@type": "Organization", name: "ZYRAXON AI" },
            publisher: { "@type": "Organization", name: "ZYRAXON AI" },
            datePublished: new Date().toISOString(),
          }),
        },
      ],
    };
  },
  component: SharePage,
});

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0f]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-wider text-cyan-300/70">
        <span>{lang || "code"}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-white/10"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderContent(content: string) {
  const blocks = content.split(/```/g);
  return blocks.map((block, i) => {
    if (i % 2 === 1) {
      const nl = block.indexOf("\n");
      const lang = nl > 0 ? block.slice(0, nl).trim() : "";
      const code = nl > 0 ? block.slice(nl + 1) : block;
      return <CodeBlock key={i} code={code.replace(/\s+$/, "")} lang={lang} />;
    }
    return (
      <p key={i} className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
        {block}
      </p>
    );
  });
}

function SharePage() {
  const { id } = Route.useParams();
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/shares/${id}/data`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`);
        return body as Share;
      })
      .then((data) => alive && setShare(data))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const partsByMessage = useMemo(() => {
    const map = new Map<string, Record<string, unknown>[]>();
    for (const p of share?.parts ?? []) {
      const key = String(p["messageID"] ?? "");
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [share]);

  if (error) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md py-12 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Share unavailable</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">{error}</p>
          <div className="mt-6 flex justify-center">
            <ButtonLink to="/" size="md">
              Back to home
            </ButtonLink>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!share) {
    return (
      <PageShell>
        <div className="grid gap-4">
          <div className="zx-glass h-32 animate-pulse rounded-2xl" />
          <div className="zx-glass h-48 animate-pulse rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  const title = (share.session?.["title"] as string) || "Untitled session";

  return (
    <PageShell>
      <header className="border-b border-border pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              ZYRAXON AI · Shared session
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Created {new Date(share.timeCreated).toLocaleString()} · Updated{" "}
              {new Date(share.timeUpdated).toLocaleString()}
            </p>
            {share.models.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {share.models.map((m, i) => (
                  <Tag key={i} tone="primary">
                    {(m["name"] as string) || `${m["providerID"]}/${m["modelID"]}`}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="zx-chip self-start rounded-full px-4 py-2 text-[13px] font-semibold text-foreground"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </header>

      <div className="py-8">
        <section className="space-y-5">
          {share.messages.length === 0 && (
            <Card className="p-8 text-center text-[13.5px] text-muted-foreground">
              No messages have been synced to this share yet.
            </Card>
          )}
          {share.messages.map((msg, i) => {
            const role = String(msg["role"] ?? "assistant");
            const isUser = role === "user";
            const extraParts = partsByMessage.get(String(msg["id"] ?? "")) ?? [];
            return (
              <article
                key={String(msg["id"] ?? i)}
                className={`rounded-2xl border p-5 ${
                  isUser ? "border-primary/30 bg-primary/5" : "zx-glass"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span
                    className={isUser ? "text-primary" : "text-fuchsia-500 dark:text-fuchsia-300"}
                  >
                    {isUser ? "You" : "ZYRAXON"}
                  </span>
                  {msg["model"] ? <span>· {String(msg["model"])}</span> : null}
                  {msg["timeCreated"] ? (
                    <span>· {new Date(String(msg["timeCreated"])).toLocaleString()}</span>
                  ) : null}
                </div>
                {renderContent(String(msg["content"] ?? ""))}
                {extraParts.map((p, j) => (
                  <div key={j}>{renderContent(String(p["content"] ?? ""))}</div>
                ))}
              </article>
            );
          })}
        </section>

        {share.diffs.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight text-foreground">File changes</h2>
            <div className="mt-4 space-y-4">
              {share.diffs.map((d, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0f]"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-sm">
                    <span className="font-mono text-slate-200">{String(d["path"] ?? "file")}</span>
                    <span className="font-mono text-xs">
                      <span className="text-emerald-400">+{Number(d["additions"] ?? 0)}</span>{" "}
                      <span className="text-rose-400">-{Number(d["deletions"] ?? 0)}</span>
                    </span>
                  </div>
                  <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
                    {String(d["content"] ?? "")
                      .split("\n")
                      .map((line, k) => (
                        <div
                          key={k}
                          className={
                            line.startsWith("+")
                              ? "bg-emerald-500/10 text-emerald-300"
                              : line.startsWith("-")
                                ? "bg-rose-500/10 text-rose-300"
                                : "text-slate-300"
                          }
                        >
                          {line || " "}
                        </div>
                      ))}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-border pt-6 text-[12px] text-muted-foreground">
          Published with ZYRAXON AI · share id {share.id}
        </footer>
      </div>
    </PageShell>
  );
}
