import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import UpdatesStudio from "@/components/updates-studio";

export const Route = createFileRoute("/nebula")({
  head: () => ({
    meta: [
      { title: "ZYRAXON Nebula — Command Deck" },
      {
        name: "description",
        content:
          "Nebula Core: the ZYRAXON operator command deck for publishing updates, announcements and telemetry. Private to the project owner.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NebulaPage,
});

const GITHUB_REPO = "onelpawarai-X/ZYRAXON-AI";
const KEY_STORAGE = "nebula.key";

const TABS = [
  { id: "studio", label: "Content Studio" },
  { id: "docs", label: "GitHub Docs" },
  { id: "releases", label: "Releases" },
  { id: "telemetry", label: "Health" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function NebulaPage() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("studio");

  const [docsList, setDocsList] = useState<{ name: string; path: string }[]>([]);
  const [selectedDoc, setSelectedDoc] = useState("README.md");
  const [docContent, setDocContent] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  const [releases, setReleases] = useState<any[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) {
      setKey(saved);
      setUnlocked(true);
    }
  }, []);

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/public/nebula?action=verify", {
      headers: { "x-nebula-key": password.trim() },
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));

    if (res?.success) {
      localStorage.setItem(KEY_STORAGE, password.trim());
      setKey(password.trim());
      setUnlocked(true);
      setError("");
    } else {
      setError("Incorrect password");
    }
  };

  const lock = () => {
    localStorage.removeItem(KEY_STORAGE);
    setKey("");
    setUnlocked(false);
    setPassword("");
  };

  const loadDocFile = async (path: string) => {
    setLoadingDoc(true);
    setSelectedDoc(path);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/${path}`);
      setDocContent(res.ok ? await res.text() : "Could not load this document.");
    } catch {
      setDocContent("Could not load this document.");
    } finally {
      setLoadingDoc(false);
    }
  };

  useEffect(() => {
    if (!unlocked || tab !== "docs") return;
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/docs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((files) => {
        if (!Array.isArray(files)) return;
        setDocsList([
          { name: "README.md", path: "README.md" },
          ...files
            .filter((f: any) => f.name?.endsWith(".md") || f.name?.endsWith(".txt"))
            .map((f: any) => ({ name: f.name, path: f.path })),
        ]);
      })
      .catch(() => {});
    loadDocFile("README.md");
  }, [unlocked, tab]);

  useEffect(() => {
    if (!unlocked || tab !== "releases") return;
    setLoadingReleases(true);
    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`)
      .then((r) => (r.ok ? r.json() : []))
      .then((r) => setReleases(Array.isArray(r) ? r : []))
      .catch(() => setReleases([]))
      .finally(() => setLoadingReleases(false));
  }, [unlocked, tab]);

  /* ------------------------------ locked ------------------------------ */
  if (!unlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--plane)] px-6">
        <form
          onSubmit={unlock}
          className="w-full max-w-sm rounded-2xl border zx-glass p-8 shadow-sm"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-primary-foreground">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
            Nebula Command Deck
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Enter the access key to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Access key"
            autoFocus
            className="mt-6 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
          <button
            type="submit"
            className="mt-5 w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            Unlock deck
          </button>
        </form>
      </div>
    );
  }

  /* ------------------------------ unlocked ---------------------------- */
  return (
    <div className="min-h-screen bg-[var(--plane)] text-foreground antialiased">
      <header className="sticky top-0 z-50 border-b zx-glass/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-primary-foreground">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </span>
            <div>
              <p className="text-[15px] font-bold leading-tight tracking-tight">
                Nebula Command Deck
              </p>
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected to {GITHUB_REPO}
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-border"
            >
              View site
            </a>
            <button
              onClick={lock}
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Lock
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-border px-6 py-2 md:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {tab === "studio" && <UpdatesStudio accessKey={key} />}

        {tab === "docs" && (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <aside className="rounded-2xl border zx-glass p-4 shadow-sm">
              <input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search documents"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <ul className="mt-4 space-y-1">
                {docsList
                  .filter((d) => d.name.toLowerCase().includes(docSearch.toLowerCase()))
                  .map((d) => (
                    <li key={d.path}>
                      <button
                        onClick={() => loadDocFile(d.path)}
                        className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                          selectedDoc === d.path
                            ? "bg-primary/12 text-primary"
                            : "text-muted-foreground hover:bg-foreground/5"
                        }`}
                      >
                        {d.name}
                      </button>
                    </li>
                  ))}
              </ul>
            </aside>

            <section className="rounded-2xl border zx-glass p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-4">
                <h2 className="font-mono text-sm font-bold text-foreground">{selectedDoc}</h2>
                <a
                  href={`https://github.com/${GITHUB_REPO}/blob/main/${selectedDoc}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Open on GitHub
                </a>
              </div>
              {loadingDoc ? (
                <p className="text-sm text-muted-foreground">Loading from GitHub…</p>
              ) : (
                <pre className="max-h-[65vh] overflow-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
                  {docContent}
                </pre>
              )}
            </section>
          </div>
        )}

        {tab === "releases" && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Releases & binaries</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Straight from the GitHub releases API for {GITHUB_REPO}.
                </p>
              </div>
              <a
                href={`https://github.com/${GITHUB_REPO}/releases/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
              >
                New release
              </a>
            </div>

            {loadingReleases ? (
              <p className="text-sm text-muted-foreground">Fetching releases…</p>
            ) : releases.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
                No public releases found.
              </p>
            ) : (
              <ul className="space-y-4">
                {releases.map((rel) => (
                  <li key={rel.id} className="rounded-2xl border zx-glass p-6 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-bold tracking-tight">
                        {rel.name || rel.tag_name}
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(rel.published_at).toLocaleDateString()}</span>
                        <a
                          href={rel.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:underline"
                        >
                          GitHub
                        </a>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(rel.assets ?? []).map((a: any) => (
                        <a
                          key={a.id}
                          href={a.browser_download_url}
                          className="rounded-lg border border-border bg-foreground/5 px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                        >
                          {a.name} · {(a.size / 1024 / 1024).toFixed(1)} MB
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "telemetry" && (
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                label: "Storage backend",
                value: "Lovable Cloud",
                hint: "Supabase + private bucket",
                tone: "text-primary",
              },
              {
                label: "Target repository",
                value: "ZYRAXON-AI",
                hint: GITHUB_REPO,
                tone: "text-foreground",
              },
              {
                label: "Access",
                value: "Authenticated",
                hint: "Session active",
                tone: "text-emerald-600",
              },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border zx-glass p-6 shadow-sm">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {c.label}
                </p>
                <p className={`mt-2 text-xl font-bold ${c.tone}`}>{c.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
