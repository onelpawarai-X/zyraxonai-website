import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Section, Tag } from "@/components/site/ui";

export const Route = createFileRoute("/publish")({
  head: () => ({
    meta: [
      { title: "Publish — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Publish your project to the ZYRAXON Ecosystem marketplace. Auto-scanned for security and shared with the community.",
      },
      { name: "keywords", content: "publish AI website, deploy site, ZYRAXON publish" },
      { property: "og:title", content: "Publish — ZYRAXON AI" },
      {
        property: "og:description",
        content:
          "Publish your project to the ZYRAXON Ecosystem marketplace. Auto-scanned for security and shared with the community.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/publish" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/publish" }],
  }),
  component: PublishPage,
});

const ENDPOINT = "https://agent-ecosystem-hub.lovable.app/api/public/v1";

const inputCls =
  "w-full rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

interface PublishedApp {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  source_agent: string;
  author_name: string;
  cover_url: string;
  live_url: string;
  repo_url: string;
  version: string;
  tags: string[];
  published_at: string;
  scan?: { score: number; blocked: boolean; findings: string[] };
}

interface PublishResult {
  slug: string;
  status: string;
  scan?: { score: number; blocked: boolean; findings: string[] };
  url: string;
}

const EMPTY_FORM = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  category: "website",
  source_agent: "cloud",
  author_name: "",
  live_url: "",
  repo_url: "",
  version: "1.0.0",
  tags: "",
  publish: false,
};

function PublishPage() {
  return (
    <PageShell>
      <PageHeader
        label="Ecosystem"
        title="Publish a project"
        description="Send your project to the ZYRAXON Ecosystem Hub. It is auto-scanned for security, then published live for the community."
      />
      <PublishForm />
      <PublishedAppsSection />
    </PageShell>
  );
}

function PublishForm() {
  const [apiKey, setApiKey] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [sourceFiles, setSourceFiles] = useState<{ path: string; content: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<"form" | "publishing" | "done" | "error">("form");
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState("");

  async function handleFileDrop(files: FileList) {
    const results: { path: string; content: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        results.push({ path: files[i].name, content: await files[i].text() });
      } catch {
        results.push({ path: files[i].name, content: "[binary]" });
      }
    }
    setSourceFiles((prev) => [...prev, ...results]);
  }

  const update = (field: string, value: string | boolean) =>
    setForm((p) => ({ ...p, [field]: value }));

  const generateSlug = () => {
    if (form.slug) return;
    update(
      "slug",
      form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  };

  const handleSubmit = async () => {
    if (!form.name || !form.slug || !apiKey) return;
    setStep("publishing");
    setError("");
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const body: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        tagline: form.tagline,
        description: form.description,
        category: form.category,
        source_agent: form.source_agent,
        author_name: form.author_name,
        live_url: form.live_url || undefined,
        repo_url: form.repo_url || undefined,
        version: form.version,
        tags,
        publish: true,
      };
      if (sourceFiles.length > 0) body.files = sourceFiles;
      const res = await fetch(`${ENDPOINT}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-zyraxon-key": apiKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.slug || data.status) {
        setResult(data);
        setStep("done");
      } else {
        setError(data.message || data.error || "Publish failed");
        setStep("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setStep("error");
    }
  };

  const canSubmit = Boolean(form.name && form.slug && apiKey);

  return (
    <section className="mb-14">
      <Card className="p-6 sm:p-7">
        <div className="rounded-xl bg-primary/10 p-4">
          <h3 className="text-[13.5px] font-bold text-primary">How it works</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-muted-foreground">
            <li>Enter your agent API key (from your ZYRAXON agent).</li>
            <li>Fill in your project details.</li>
            <li>
              Press <strong className="text-foreground">Publish</strong> — the system auto-scans
              your code.
            </li>
            <li>If no critical findings appear, your project goes live on the marketplace.</li>
            <li>Share the link, or connect GitHub to track stats.</li>
          </ol>
        </div>

        {step === "form" && (
          <div className="mt-6 grid gap-4">
            <div>
              <span className={labelCls}>Agent API key *</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="x-zyraxon-key"
                className={inputCls + " mt-1.5"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelCls}>Project name *</span>
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  onBlur={generateSlug}
                  placeholder="My project"
                  className={inputCls + " mt-1.5"}
                />
              </div>
              <div>
                <span className={labelCls}>Slug *</span>
                <input
                  value={form.slug}
                  onChange={(e) => update("slug", e.target.value)}
                  placeholder="my-project"
                  className={inputCls + " mt-1.5"}
                />
              </div>
            </div>

            <div>
              <span className={labelCls}>Tagline</span>
              <input
                value={form.tagline}
                onChange={(e) => update("tagline", e.target.value)}
                placeholder="One line description"
                className={inputCls + " mt-1.5"}
              />
            </div>

            <div>
              <span className={labelCls}>Description *</span>
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={4}
                placeholder="Full description of your project…"
                className={inputCls + " mt-1.5 resize-y"}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className={labelCls}>Category</span>
                <select
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  className={inputCls + " mt-1.5"}
                >
                  {[
                    "website",
                    "plugin",
                    "template",
                    "theme",
                    "bot",
                    "tool",
                    "cli",
                    "sdk",
                    "model",
                    "app",
                    "other",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>Source agent</span>
                <select
                  value={form.source_agent}
                  onChange={(e) => update("source_agent", e.target.value)}
                  className={inputCls + " mt-1.5"}
                >
                  {["cloud", "desktop", "mobile", "code"].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>Version</span>
                <input
                  value={form.version}
                  onChange={(e) => update("version", e.target.value)}
                  placeholder="1.0.0"
                  className={inputCls + " mt-1.5"}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelCls}>Author name</span>
                <input
                  value={form.author_name}
                  onChange={(e) => update("author_name", e.target.value)}
                  placeholder="Your name"
                  className={inputCls + " mt-1.5"}
                />
              </div>
              <div>
                <span className={labelCls}>Tags (comma separated)</span>
                <input
                  value={form.tags}
                  onChange={(e) => update("tags", e.target.value)}
                  placeholder="react, typescript, landing"
                  className={inputCls + " mt-1.5"}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={labelCls}>Live URL</span>
                <input
                  value={form.live_url}
                  onChange={(e) => update("live_url", e.target.value)}
                  placeholder="https://…"
                  className={inputCls + " mt-1.5"}
                />
              </div>
              <div>
                <span className={labelCls}>GitHub repo URL</span>
                <input
                  value={form.repo_url}
                  onChange={(e) => update("repo_url", e.target.value)}
                  placeholder="https://github.com/…"
                  className={inputCls + " mt-1.5"}
                />
              </div>
            </div>

            <div>
              <span className={labelCls}>Source code (upload your project files)</span>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length) await handleFileDrop(e.dataTransfer.files);
                }}
                className={`mt-1.5 rounded-xl border-2 border-dashed p-6 text-center transition ${
                  dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-border"
                }`}
              >
                <input
                  type="file"
                  multiple
                  id="src-files"
                  onChange={async (e) => {
                    if (e.target.files?.length) await handleFileDrop(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <p className="text-[13px] text-muted-foreground">
                  Drop files here or{" "}
                  <button
                    type="button"
                    onClick={() => document.getElementById("src-files")?.click()}
                    className="font-semibold text-primary underline"
                  >
                    browse
                  </button>
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Source files for auto-scan and publish
                </p>
              </div>
              {sourceFiles.length > 0 && (
                <div className="mt-2 max-h-32 space-y-1 overflow-auto">
                  {sourceFiles.map((f, i) => (
                    <div
                      key={`${f.path}-${i}`}
                      className="zx-chip flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="truncate font-mono text-[12px] text-foreground">
                        {f.path}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSourceFiles((p) => p.filter((_, j) => j !== i))}
                        className="shrink-0 text-[12px] text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSourceFiles([])}
                    className="text-[12px] text-muted-foreground underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="zx-sheen inline-flex h-11 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
              >
                Publish
              </button>
            </div>
          </div>
        )}

        {step === "publishing" && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-border border-t-primary" />
            <p className="text-[13.5px] text-muted-foreground">
              Publishing… scanning your code for security findings.
            </p>
          </div>
        )}

        {step === "done" && result && (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/12 text-2xl text-emerald-600 dark:text-emerald-400">
              ✓
            </span>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground">Published</h3>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              {result.scan?.blocked
                ? "Published with warnings — some findings were detected."
                : "Your project is live on the marketplace."}
            </p>
            {result.scan && (
              <div
                className={`mx-auto mt-4 max-w-md rounded-xl p-4 text-left ${
                  result.scan.blocked ? "bg-red-500/10" : "bg-emerald-500/10"
                }`}
              >
                <p className="text-[13px] font-semibold text-foreground">
                  Security score: {result.scan.score}/100
                </p>
                {result.scan.findings.length > 0 && (
                  <ul className="mt-1.5 list-disc pl-5 text-[12px] leading-relaxed text-muted-foreground">
                    {result.scan.findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {result.url && (
                <ButtonAnchor href={result.url} size="sm">
                  View on marketplace
                </ButtonAnchor>
              )}
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setResult(null);
                  setForm(EMPTY_FORM);
                  setSourceFiles([]);
                }}
                className="zx-chip inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold text-foreground"
              >
                Publish another
              </button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/12 text-2xl text-red-500">
              ✕
            </span>
            <h3 className="mt-4 text-lg font-bold tracking-tight text-foreground">
              Publish failed
            </h3>
            <p className="mt-1.5 text-[13.5px] text-red-500">{error}</p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="zx-chip inline-flex h-9 items-center rounded-full px-4 text-[13px] font-semibold text-foreground"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

function PublishedAppsSection() {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${ENDPOINT}/apps`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setApps(d);
        else if (d.apps) setApps(d.apps);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Section
      label="Marketplace"
      title="Published apps"
      description={loading ? "Loading…" : `${apps.length} projects live on the marketplace.`}
    >
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="zx-glass h-56 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && apps.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-[13.5px] text-muted-foreground">
            No published apps yet. Be the first to publish.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <Card key={app.slug} hover className="flex flex-col overflow-hidden">
            {app.cover_url && (
              <div className="h-40 overflow-hidden bg-foreground/5">
                <img src={app.cover_url} alt={app.name} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="muted">{app.category}</Tag>
                <Tag tone="primary">{app.source_agent}</Tag>
                {app.version && (
                  <span className="text-[11px] text-muted-foreground">v{app.version}</span>
                )}
              </div>
              <h3 className="mt-3 text-[15px] font-bold tracking-tight text-foreground">
                {app.name}
              </h3>
              {app.tagline && (
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {app.tagline}
                </p>
              )}
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                by {app.author_name || "Anonymous"}
              </p>
              {app.tags && app.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {app.tags.slice(0, 5).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {app.live_url && (
                  <ButtonAnchor href={app.live_url} size="sm">
                    Live demo
                  </ButtonAnchor>
                )}
                {app.repo_url && (
                  <ButtonAnchor href={app.repo_url} variant="glass" size="sm">
                    GitHub
                  </ButtonAnchor>
                )}
                {app.scan && (
                  <Tag tone={app.scan.blocked ? "warn" : "success"}>Score {app.scan.score}/100</Tag>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
