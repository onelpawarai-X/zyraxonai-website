import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";

export const Route = createFileRoute("/releases")({
  head: () => ({
    meta: [
      { title: "Releases — ZYRAXON AI" },
      { name: "description", content: "All GitHub releases for ZYRAXON Agent. Download the latest installers and changelogs." },
      { property: "og:title", content: "Releases — ZYRAXON AI" },
      { property: "og:description", content: "All GitHub releases for ZYRAXON Agent. Download the latest installers and changelogs." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/releases" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReleasesPage,
});

const REPOS = [
  { owner: "onelpawarai-X", name: "ZYRAXON-AI", label: "ZYRAXON Agent", color: "#2563eb", desc: "Desktop AI agent with 11 agent modes, 888 tools across 63 categories" },
];

function ReleasesPage() {
  return (
    <PageShell>
      <PageHeader
        label="ZYRAXON-AI // Releases"
        title="All releases"
        description="Every version of every ZYRAXON project, with assets and changelogs pulled live from GitHub."
      />
      <div className="grid gap-12">
        {REPOS.map((repo) => (
          <RepoSection key={repo.name} repo={repo} />
        ))}
      </div>
    </PageShell>
  );
}

function RepoSection({ repo }: { repo: (typeof REPOS)[0] }) {
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/releases?per_page=20`, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setReleases(d.filter((x: any) => !x.draft));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [repo.owner, repo.name]);

  const totalDownloads = releases.reduce(
    (s, r) => s + (r.assets || []).reduce((s2: number, a: any) => s2 + (a.download_count || 0), 0),
    0,
  );

  return (
    <section>
      <div className="flex items-center gap-3.5">
        <span className="zx-glass grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-primary">
          {repo.label.charAt(0)}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{repo.label}</h2>
          <p className="text-[13px] text-muted-foreground">{repo.desc}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {releases.length} releases · {totalDownloads.toLocaleString()} downloads
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {loading && (
          <Card className="p-8 text-center text-[13px] text-muted-foreground">
            Loading releases…
          </Card>
        )}
        {!loading && releases.length === 0 && (
          <Card className="p-8 text-center text-[13px] text-muted-foreground">
            No releases yet.
          </Card>
        )}
        {releases.map((r) => {
          const isOpen = expanded === r.id;
          const rDownloads = (r.assets || []).reduce(
            (s: number, a: any) => s + (a.download_count || 0),
            0,
          );
          return (
            <Card key={r.id} className="overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : r.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-foreground">
                    {r.name || r.tag_name}
                  </span>
                  <span className="zx-chip rounded-md px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {r.tag_name}
                  </span>
                  {r.prerelease && <Tag tone="warn">Pre-release</Tag>}
                </div>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {new Date(r.published_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {rDownloads.toLocaleString()} dl
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-border px-5 py-4">
                  {r.body && (
                    <pre className="zx-glass max-h-52 overflow-auto whitespace-pre-wrap rounded-xl p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      {r.body}
                    </pre>
                  )}
                  <div className="mt-3 grid gap-2">
                    {(r.assets || []).map((a: any) => (
                      <a
                        key={a.name}
                        href={a.browser_download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="zx-chip flex items-center justify-between rounded-xl px-3.5 py-2.5"
                      >
                        <span className="min-w-0 truncate text-[13px] text-foreground">
                          {a.name}
                        </span>
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          {fmtSize(a.size)} · {a.download_count} dl
                        </span>
                      </a>
                    ))}
                  </div>
                  <div className="mt-3">
                    <ButtonAnchor href={r.html_url} variant="ghost" size="sm">
                      View on GitHub
                    </ButtonAnchor>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function fmtSize(b: number): string {
  if (!b) return "";
  if (b > 1e9) return (b / 1e9).toFixed(1) + " GB";
  if (b > 1e6) return (b / 1e6).toFixed(0) + " MB";
  return (b / 1e3).toFixed(0) + " KB";
}
