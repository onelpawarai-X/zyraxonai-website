import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

type Asset = { name: string; size: number; url: string; downloads: number };
type Release = {
  id: number;
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  prerelease: boolean;
  body: string | null;
  totalDownloads: number;
  assets: Asset[];
};
type RepoData = {
  id: string;
  label: string;
  color: string;
  description: string;
  fullName: string;
  url: string;
  stars: number;
  releases: Release[];
};

const REPOS = [
  { id: "zyraxon-agent", owner: "onelpawarai-X", name: "ZYRAXON-AI", label: "ZYRAXON Agent", color: "#2563eb", description: "Desktop AI agent with 9 modes, 552+ tools, eternal memory, screen vision" },
  { id: "myra-agent", owner: "onelpawarai-X", name: "Myra-Agent", label: "Myra Agent", color: "#f59e0b", description: "Android voice AI agent with multi-personality, Gemini Live, WhatsApp auto-reply" },
  { id: "zyraxon-code", owner: "onelpawarai-X", name: "Zyraxon-Code", label: "ZYRAXON Code", color: "#7c3aed", description: "AI-powered code editor with built-in AI assistant" },
];

export const Route = createFileRoute("/releases")({
  head: () => ({ meta: [{ title: "Releases — ZYRAXON AI" }, { name: "description", content: "All releases for ZYRAXON Agent, Myra Agent, and ZYRAXON Code." }] }),
});

function fmtSize(b: number): string {
  if (!b) return "";
  if (b > 1e9) return (b / 1e9).toFixed(1) + " GB";
  if (b > 1e6) return (b / 1e6).toFixed(0) + " MB";
  return (b / 1e3).toFixed(0) + " KB";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

async function ghFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.json();
}

async function fetchRepoData(repo: typeof REPOS[0]): Promise<RepoData> {
  try {
    const repoInfo = await ghFetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`);
    const releases: any[] = await ghFetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/releases?per_page=50`);
    const filtered = (Array.isArray(releases) ? releases : []).filter((r: any) => !r.draft);
    const normalized: Release[] = filtered.map((r: any) => {
      const totalDownloads = (r.assets || []).reduce((sum: number, a: any) => sum + (a.download_count || 0), 0);
      return {
        id: r.id,
        tag: r.tag_name,
        name: r.name || r.tag_name,
        url: r.html_url,
        publishedAt: r.published_at,
        prerelease: r.prerelease,
        body: r.body,
        totalDownloads,
        assets: (r.assets || []).map((a: any) => ({
          name: a.name,
          size: a.size,
          url: a.browser_download_url,
          downloads: a.download_count || 0,
        })),
      };
    });
    return {
      id: repo.id,
      label: repo.label,
      color: repo.color,
      description: repo.description,
      fullName: `${repo.owner}/${repo.name}`,
      url: `https://github.com/${repo.owner}/${repo.name}`,
      stars: repoInfo.stargazers_count || 0,
      releases: normalized,
    };
  } catch {
    return {
      id: repo.id,
      label: repo.label,
      color: repo.color,
      description: repo.description,
      fullName: `${repo.owner}/${repo.name}`,
      url: `https://github.com/${repo.owner}/${repo.name}`,
      stars: 0,
      releases: [],
    };
  }
}

function AssetRow({ asset }: { asset: Asset }) {
  const icon = asset.name.endsWith(".exe") || asset.name.endsWith(".msi") ? "Windows" :
    asset.name.endsWith(".dmg") || asset.name.includes("mac") || asset.name.includes("darwin") ? "macOS" :
    asset.name.endsWith(".AppImage") || asset.name.endsWith(".deb") || asset.name.includes("linux") ? "Linux" :
    asset.name.endsWith(".apk") ? "Android" : "File";
  return (
    <a href={asset.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 transition-all hover:border-blue-200 hover:shadow-sm group">
      <div className="flex items-center gap-3 min-w-0">
        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500 shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">{asset.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{fmtSize(asset.size)}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-medium text-gray-500">{fmtNumber(asset.downloads)}</div>
          <div className="text-[10px] text-gray-400">downloads</div>
        </div>
        <div className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          Download
        </div>
      </div>
    </a>
  );
}

function ReleaseCard({ release, defaultOpen }: { release: Release; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border transition-all ${release.prerelease ? "border-amber-200 bg-amber-50/30" : "border-gray-200 bg-white"} ${open ? "shadow-md" : "shadow-sm hover:shadow-md"}`}>
      <button onClick={() => setOpen(!open)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-gray-900">{release.name}</span>
            <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-600">{release.tag}</span>
            {release.prerelease && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Pre-release</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{fmtDate(release.publishedAt)}</span>
            <span>{fmtNumber(release.totalDownloads)} downloads</span>
            <span>{release.assets.length} files</span>
          </div>
        </div>
        <svg className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {release.body && (
            <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
              {release.body}
            </div>
          )}
          <div className="mt-4 space-y-2">
            {release.assets.map((a) => <AssetRow key={a.name} asset={a} />)}
          </div>
          <div className="mt-3 text-right">
            <a href={release.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-blue-600 underline">View on GitHub</a>
          </div>
        </div>
      )}
    </div>
  );
}

function RepoSection({ data }: { data: RepoData }) {
  return (
    <section className="mb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: data.color }}>
              {data.label.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{data.label}</h2>
              <p className="text-sm text-gray-500">{data.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 sm:ml-[52px] text-xs text-gray-400">
            <span>{fmtNumber(data.stars)} stars</span>
            <span>{data.releases.length} releases</span>
            <span>{fmtNumber(data.releases.reduce((s, r) => s + r.totalDownloads, 0))} downloads</span>
          </div>
        </div>
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors text-center">
          View Repository
        </a>
      </div>
      {data.releases.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">No releases yet.</div>
      )}
      <div className="space-y-3">
        {data.releases.map((r, i) => <ReleaseCard key={r.id} release={r} defaultOpen={i === 0} />)}
      </div>
    </section>
  );
}

export default function ReleasesPage() {
  const [repos, setRepos] = useState<RepoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(REPOS.map(fetchRepoData));
        if (!cancelled) setRepos(results);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalReleases = repos.reduce((s, r) => s + r.releases.length, 0);
  const totalDownloads = repos.reduce((s, r) => s + r.releases.reduce((s2, rel) => s2 + rel.totalDownloads, 0), 0);

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="/" target="_top" className="flex items-center gap-2.5 no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-lg font-black text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>Z</span>
            <span className="text-sm font-bold tracking-tight text-gray-900">ZYRAXON-AI</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/" target="_top" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors no-underline">Home</a>
            <a href="/docs" target="_top" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors no-underline">Docs</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-600 mb-3">ZYRAXON-AI // Releases</div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">All Releases</h1>
          <p className="mt-4 max-w-2xl mx-auto text-gray-500 leading-relaxed">
            Every version of every ZYRAXON project. Download, explore changelogs, and see what's new.
          </p>
          {!loading && (
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-400">
              <span><strong className="text-gray-900">{totalReleases}</strong> releases</span>
              <span><strong className="text-gray-900">{fmtNumber(totalDownloads)}</strong> downloads</span>
              <span><strong className="text-gray-900">{REPOS.length}</strong> projects</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-400">Loading releases from GitHub...</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Retry</button>
          </div>
        )}

        {!loading && repos.map((r) => <RepoSection key={r.id} data={r} />)}
      </main>

      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 sm:flex-row sm:px-6">
          <span>ZYRAXON-AI // All in one. Anything. Nothing is impossible.</span>
          <a href="/" target="_top" className="no-underline hover:text-blue-600">Home</a>
        </div>
      </footer>
    </div>
  );
}
