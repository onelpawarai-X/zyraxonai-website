import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";

type Asset = { name: string; size: number; url: string; downloads: number; type: string };
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
  repo: { id: string; label: string; color: string; description: string; fullName: string; url: string; stars: number; forks: number; language: string | null };
  releases: Release[];
  totalDownloads: number;
  latestTag: string | null;
};

export const Route = createFileRoute("/releases")({
  head: () => ({ meta: [{ title: "Releases — ZYRAXON AI" }, { name: "description", content: "All releases for ZYRAXON Agent, Myra Agent, and ZYRAXON Code. Download, changelogs, and version history." }] }),
});

function fmtSize(b: number): string {
  if (!b) return "";
  if (b > 1e9) return (b / 1e9).toFixed(1) + " GB";
  if (b > 1e6) return (b / 1e6).toFixed(0) + " MB";
  return (b / 1e3).toFixed(0) + " KB";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function parseMd(body: string | null): string {
  if (!body) return "";
  return body
    .replace(/^### (.+)$/gm, '<h3 class="mt-4 mb-2 text-sm font-bold text-gray-900">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="mt-5 mb-2 text-base font-bold text-gray-900">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="mt-6 mb-2 text-lg font-bold text-gray-900">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono text-indigo-600">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 underline hover:text-blue-800">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-gray-600 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-gray-600 list-decimal">$2</li>')
    .replace(/\n{2,}/g, '</p><p class="mt-2 text-sm text-gray-600 leading-relaxed">')
    .replace(/\n/g, " ");
}

function AssetRow({ asset }: { asset: Asset }) {
  const icon = asset.name.endsWith(".exe") || asset.name.endsWith(".msi")
    ? "🪟"
    : asset.name.endsWith(".dmg") || asset.name.includes("mac") || asset.name.includes("darwin")
    ? "🍎"
    : asset.name.endsWith(".AppImage") || asset.name.endsWith(".deb") || asset.name.endsWith(".rpm") || asset.name.includes("linux")
    ? "🐧"
    : asset.name.endsWith(".apk")
    ? "📱"
    : "📦";
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3 transition-all hover:border-blue-200 hover:shadow-sm group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">{asset.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{fmtSize(asset.size)}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-xs font-medium text-gray-500">{fmtNumber(asset.downloads)}</div>
          <div className="text-[10px] text-gray-400">downloads</div>
        </div>
        <div className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
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
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {fmtNumber(release.totalDownloads)} total
            </span>
            <span>{release.assets.length} files</span>
          </div>
        </div>
        <svg className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {release.body && (
            <div
              className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600 leading-relaxed max-h-60 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: "<p>" + parseMd(release.body) + "</p>" }}
            />
          )}
          <div className="mt-4 space-y-2">
            {release.assets.map((a) => (
              <AssetRow key={a.name} asset={a} />
            ))}
          </div>
          <div className="mt-3 text-right">
            <a href={release.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-blue-600 underline">
              View on GitHub
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function RepoSection({ data }: { data: RepoData }) {
  const { repo, releases, totalDownloads, latestTag } = data;
  return (
    <section className="mb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: repo.color }}>
              {repo.label.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{repo.label}</h2>
              <p className="text-sm text-gray-500">{repo.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 ml-[52px] text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {fmtNumber(repo.stars)} stars
            </span>
            <span>{fmtNumber(repo.forks)} forks</span>
            {repo.language && <span>{repo.language}</span>}
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {fmtNumber(totalDownloads)} downloads
            </span>
            {latestTag && <span className="font-mono text-green-600 font-semibold">Latest: {latestTag}</span>}
          </div>
        </div>
        <a href={repo.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors text-center">
          View Repository
        </a>
      </div>
      <div className="space-y-3">
        {releases.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No releases yet.</div>
        )}
        {releases.map((r, i) => (
          <ReleaseCard key={r.id} release={r} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}

export default function ReleasesPage() {
  const [data, setData] = useState<RepoData[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/public/zyraxon-releases");
      const json = await res.json();
      if (json.success) {
        setData(json.repos);
      } else {
        setError(json.error || "Failed to load releases");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grandTotal = data?.reduce((sum, r) => sum + r.totalDownloads, 0) ?? 0;
  const totalReleases = data?.reduce((sum, r) => sum + r.releases.length, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="/" target="_top" className="flex items-center gap-2.5 no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-lg font-black text-white" style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>Z</span>
            <span className="text-sm font-bold tracking-tight text-gray-900">ZYRAXON-AI</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/docs" target="_top" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors no-underline">Docs</a>
            <a href="/ecosystem" target="_top" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors no-underline">Ecosystem</a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-blue-600 mb-3">ZYRAXON-AI // Releases</div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">All Releases</h1>
          <p className="mt-4 max-w-2xl mx-auto text-gray-500 leading-relaxed">
            Every version of every ZYRAXON project, from the first commit to the latest build.
            Download, explore changelogs, and see what's new.
          </p>
          {!loading && data && (
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-400">
              <span><strong className="text-gray-900">{totalReleases}</strong> releases</span>
              <span><strong className="text-gray-900">{fmtNumber(grandTotal)}</strong> downloads</span>
              <span><strong className="text-gray-900">{data.length}</strong> projects</span>
            </div>
          )}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-400">Loading releases from GitHub...</p>
          </div>
        )}
        {error && (
          <div className="text-center py-20">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={load} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Retry
            </button>
          </div>
        )}
        {data && data.map((repoData) => (
          <RepoSection key={repoData.repo.id} data={repoData} />
        ))}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 sm:flex-row sm:px-6">
          <span>ZYRAXON-AI // All in one. Anything. Nothing is impossible.</span>
          <a href="/" target="_top" className="no-underline hover:text-blue-600">Home</a>
        </div>
      </footer>
    </div>
  );
}
