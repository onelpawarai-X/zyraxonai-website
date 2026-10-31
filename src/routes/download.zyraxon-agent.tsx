import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { Icon } from "@/components/site/Icon";
import { CommandBox, CopyButton } from "@/components/site/provider-parts";
import { CLI_COMMANDS, CLI_PATH_COMMANDS, CLI_USAGE, GITHUB_REPO } from "@/lib/downloads";
import {
  OS_BLURB,
  OS_DETAIL,
  OS_ID,
  OS_NAME,
  OS_RELEASES_URL,
  OS_REQUIREMENTS,
  OS_TAGLINE,
  formatBytes,
  osRejoinCommand,
} from "@/lib/os-download";

const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

type Asset = { name: string; url: string; size: number | null; tag: string };
type Platforms = Record<string, Asset | null>;
/** The shape `/api/public/os` answers with. */
type OsAsset = { name: string; url: string; size: number | null };
type OsData = {
  latest: { tag: string; url: string; repo: string } | null;
  release: {
    tag: string;
    releaseUrl: string;
    primary: OsAsset | null;
    parts: OsAsset[];
    split: boolean;
    isoName: string | null;
    totalBytes: number | null;
    checksums: { name: string; hash: string }[];
    screenshot: OsAsset | null;
  } | null;
  error?: string;
};
type Resolved = {
  latest: { tag: string; url: string; repo: string } | null;
  assets: { name: string; size: number | null; url: string }[];
  platforms: Platforms;
  error?: string;
};

/** One family of buttons: the mobile app, the desktop app, the command line, the source. */
type Group = {
  key: string;
  label: string;
  blurb: string;
  icon: "monitor" | "smartphone" | "code" | "layers";
  rows: { id: string; os: string; detail: string; ext: string }[];
};

const GROUPS: Group[] = [
  {
    key: "mobile",
    label: "Mobile application",
    blurb: "The same agent in your pocket. Android installs the APK directly.",
    icon: "smartphone",
    rows: [
      {
        id: "android",
        os: "Android",
        detail: "Android 8+ · install the APK directly",
        ext: ".apk",
      },
    ],
  },
  {
    key: "desktop",
    label: "Desktop application",
    blurb: "The full app — agent, editor and 888 tools in one window.",
    icon: "monitor",
    rows: [
      {
        id: "windows",
        os: "Windows (x64)",
        detail: "Windows 10/11 · 64-bit installer",
        ext: ".exe",
      },
      {
        id: "windows-arm64",
        os: "Windows on ARM",
        detail: "Surface Pro X, Snapdragon laptops",
        ext: ".exe",
      },
      {
        id: "mac-arm",
        os: "macOS · Apple Silicon",
        detail: "macOS 12+ · M-series chips",
        ext: ".dmg",
      },
      { id: "mac-intel", os: "macOS · Intel", detail: "macOS 12+ · Intel chips", ext: ".dmg" },
      {
        id: "linux-appimage",
        os: "Linux · AppImage",
        detail: "Any distro · no install needed",
        ext: ".AppImage",
      },
      { id: "linux-deb", os: "Linux · .deb", detail: "Debian, Ubuntu, Mint", ext: ".deb" },
      { id: "linux-rpm", os: "Linux · .rpm", detail: "Fedora, RHEL, openSUSE", ext: ".rpm" },
    ],
  },
  {
    key: "cli",
    label: "Command line",
    blurb: "Headless zyraxon. Unpack it, put it on your PATH, and run it anywhere.",
    icon: "code",
    rows: [
      {
        id: "cli-windows",
        os: "Windows (x64)",
        detail: "Unpack, then run zyraxon.exe",
        ext: ".zip",
      },
      {
        id: "cli-windows-arm64",
        os: "Windows on ARM",
        detail: "Windows on ARM devices",
        ext: ".zip",
      },
      { id: "cli-mac-arm", os: "macOS · Apple Silicon", detail: "M-series Macs", ext: ".zip" },
      { id: "cli-mac-intel", os: "macOS · Intel", detail: "Intel Macs", ext: ".zip" },
      { id: "cli-linux", os: "Linux (x64)", detail: "glibc · most distros", ext: ".tar.gz" },
      {
        id: "cli-linux-musl",
        os: "Linux · musl",
        detail: "Alpine and other musl distros",
        ext: ".tar.gz",
      },
      {
        id: "cli-linux-arm64",
        os: "Linux · ARM64",
        detail: "ARM servers and boards",
        ext: ".tar.gz",
      },
    ],
  },
  {
    key: "source",
    label: "Source code",
    blurb: "The full tree at the newest tag, if you would rather build it yourself.",
    icon: "layers",
    rows: [
      { id: "source", os: "Source (.zip)", detail: "Archive of the tag", ext: ".zip" },
      { id: "source-tar", os: "Source (.tar.gz)", detail: "Archive of the tag", ext: ".tar.gz" },
    ],
  },
];

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

export const Route = createFileRoute("/download/zyraxon-agent")({
  head: () => ({
    meta: [
      { title: "Download ZYRAXON Agent — Windows, macOS, Linux and CLI" },
      {
        name: "description",
        content:
          "Direct downloads for every ZYRAXON build: desktop app and command line for Windows, macOS and Linux, plus the source archive. Every button saves the file straight from the newest release.",
      },
      {
        name: "keywords",
        content:
          "download ZYRAXON, ZYRAXON Agent installer, ZYRAXON CLI, Windows macOS Linux AI agent download",
      },
      { property: "og:title", content: "Download ZYRAXON Agent" },
      {
        property: "og:description",
        content:
          "Desktop app and CLI for Windows, macOS and Linux. Direct downloads from the newest release.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/download/zyraxon-agent" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://zyraxonai.lovable.app/download/zyraxon-agent" }],
  }),
  component: DownloadZyraxonAgent,
});

function DownloadZyraxonAgent() {
  const [data, setData] = useState<Resolved | null>(null);
  const [os, setOs] = useState<OsData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [cli, setCli] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/downloads")
      .then((r) => r.json())
      .then((json: Resolved) => {
        if (cancelled) return;
        setData(json);
        setState(json.platforms && Object.keys(json.platforms).length ? "ready" : "error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    // The OS is versioned in its own repository, so it is read from its own
    // endpoint. It is loaded beside the Agent's builds and its failure cannot
    // blank the page: the OS card falls back to a link to its releases.
    fetch("/api/public/os")
      .then((r) => r.json())
      .then((json: OsData) => {
        if (!cancelled) setOs(json);
      })
      .catch(() => {
        /* the card links to the releases page instead */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tag = data?.latest?.tag;
  const assetCount = data?.assets?.length ?? 0;

  return (
    <PageShell>
      <PageHeader
        label="Download"
        title="ZYRAXON Agent"
        description={
          state === "loading"
            ? "Finding the newest release and its files…"
            : state === "ready"
              ? "Every button saves the file directly from the newest release. None of them opens a page."
              : "Could not read the release list right now. The releases page below always works."
        }
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {tag ? (
            <Tag tone="success">Newest release {tag}</Tag>
          ) : (
            <Tag tone="muted">Checking releases…</Tag>
          )}
          {assetCount > 0 && <Tag tone="muted">{assetCount} files</Tag>}
          {data?.latest?.repo && (
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {data.latest.repo}
            </span>
          )}
        </div>
      </PageHeader>

      <OsCard os={os} />

      {/* The commands come first: most people who arrive here want the CLI, and
          a copy button beats a download for anyone who already has a terminal.
          One platform is shown at a time. Six long one-liners stacked up ran
          off the side of the page and buried the download buttons below them;
          a switcher keeps the whole block the height of a single line. */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="zx-glass grid h-9 w-9 place-items-center rounded-lg text-primary">
            <Icon name="code" size={17} />
          </span>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Install in one command
          </h2>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {CLI_COMMANDS.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setCli(i)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                  i === cli
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {c.short ?? c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <CommandBox code={CLI_COMMANDS[cli].code} label="copy command" />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
          {CLI_PATH_COMMANDS.map((c) => (
            <div key={c.label} className="min-w-0 flex-1 basis-64">
              <span className="text-[11px] font-semibold text-muted-foreground">{c.label}</span>
              <CommandBox code={c.code} className="mt-1" />
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground">Then</span>
          {CLI_USAGE.map((c) => (
            <span
              key={c.label}
              className="rounded-md bg-foreground/5 px-2 py-1 font-mono text-[11px] text-muted-foreground"
              title={c.label}
            >
              {c.code}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Each line fetches the newest build for that platform, so it keeps working when a release
          renames a file. Nothing in the archives carries the execute bit, which is why every Unix
          line runs <span className="font-mono">chmod +x</span> before it runs anything.
        </p>
      </Card>

      {GROUPS.map((g) => (
        <div key={g.key} className="mt-8">
          <div className="mb-4 flex items-start gap-3">
            <span className="zx-glass grid h-10 w-10 shrink-0 place-items-center rounded-xl text-primary">
              <Icon name={g.icon} size={19} />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">{g.label}</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{g.blurb}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.rows.map((row) => {
              const asset = data?.platforms?.[row.id];
              const available = Boolean(asset?.url);
              return (
                <Card key={row.id} hover className="flex flex-col p-5">
                  <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {row.os}
                  </h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                    {row.detail}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {row.ext}
                    {asset?.size ? ` · ${formatSize(asset.size)}` : ""}
                  </p>
                  <div className="mt-auto pt-4">
                    {/* The button is always here, whatever the resolver said.
                        It used to be swapped for a "Not in this release" label
                        when the release read failed, which turned one failed
                        fetch into sixteen dead buttons claiming a file that
                        does exist. The route resolves the asset on click and
                        falls back to the release page, so a working button is
                        always the better answer than a false absence. */}
                    <ButtonAnchor
                      href={`/api/download/${row.id}`}
                      external={false}
                      variant="glass"
                      size="sm"
                      className="w-full"
                    >
                      Download {row.ext}
                    </ButtonAnchor>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* A developer's index of the release, collapsed by default. Thirty raw
          filenames is not a download page — it is a directory listing, and it
          used to sit open at the bottom pushing the real links further up. */}
      <Card className="mt-6 p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={showAll}
        >
          <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
            Every file in this release
          </h2>
          <span className="text-[12px] text-muted-foreground">
            {assetCount > 0 ? `${assetCount} files` : "…"}
          </span>
          <span className="ml-auto text-[12px] font-semibold text-muted-foreground">
            {showAll ? "hide" : "show"}
          </span>
        </button>
        {showAll && assetCount > 0 && (
          <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {data?.assets?.map((a) => (
              <a
                key={a.name}
                href={a.url}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 font-mono text-[11.5px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <span className="truncate">{a.name}</span>
                <span className="shrink-0 text-muted-foreground/70">{formatSize(a.size)}</span>
              </a>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonAnchor href={RELEASES_URL} size="md">
          Release notes
        </ButtonAnchor>
        <ButtonAnchor href="/docs" external={false} variant="glass" size="md">
          Read the docs
        </ButtonAnchor>
      </div>
    </PageShell>
  );
}

/**
 * The ZyraxonOS card.
 *
 * It sits above the Agent's buttons because it is the whole machine, not an app
 * to run on one. Everything on it comes from the resolver: the tag, the file
 * name, the size and whether the image is one file or several parts. The one
 * thing it must get right is the split case — a part is not an ISO, so the page
 * says so and hands over the command that rejoins them rather than letting a
 * visitor boot from `part00`.
 */
function OsCard({ os }: { os: OsData | null }) {
  const rel = os?.release ?? null;
  const parts = rel?.parts ?? [];
  const rejoin =
    rel?.split && rel.isoName
      ? osRejoinCommand(
          rel.isoName,
          parts.map((p) => p.name),
        )
      : "";

  return (
    <Card className="mt-6 overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="zx-glass grid h-10 w-10 place-items-center rounded-xl text-primary">
              <Icon name="layers" size={19} />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {OS_NAME} — the whole operating system
            </h2>
            {rel?.tag ? (
              <Tag tone="success">Newest release {rel.tag}</Tag>
            ) : (
              <Tag tone="muted">{os?.error ? "Release unread" : "Checking releases…"}</Tag>
            )}
          </div>

          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {OS_BLURB}
          </p>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {OS_TAGLINE}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ButtonAnchor href={`/api/download/${OS_ID}`} external={false} size="md">
              <Icon name="layers" size={16} />
              {rel?.split ? "Download first part (.iso.part00)" : "Download ZyraxonOS (.iso)"}
            </ButtonAnchor>
            <ButtonAnchor href={OS_RELEASES_URL} variant="glass" size="md">
              Release notes
            </ButtonAnchor>
          </div>

          <p className="mt-3 font-mono text-[11.5px] text-muted-foreground">
            {OS_DETAIL}
            {rel?.totalBytes ? ` · ${formatBytes(rel.totalBytes)}` : ""}
            {rel?.isoName ? ` · ${rel.isoName}` : ""}
          </p>

          {rel?.split && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
              <p className="text-[12.5px] font-semibold text-foreground">
                This image is published in {parts.length} parts
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                GitHub refuses an asset larger than 2 GB, so the ISO is cut. Download every part,
                then rejoin them in order — a part on its own is not bootable.
              </p>
              <div className="mt-3">
                <CommandBox code={rejoin} label="copy command" />
              </div>
              <div className="mt-3 grid gap-1.5">
                {parts.map((p, i) => (
                  <a
                    key={p.name}
                    href={`/api/download/${OS_ID}-part${String(i).padStart(2, "0")}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 font-mono text-[11.5px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-muted-foreground/70">{formatBytes(p.size)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {rel?.checksums?.length ? (
            <details className="mt-4 rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-[12.5px] font-semibold text-foreground">
                Verify the download ({rel.checksums.length} checksum
                {rel.checksums.length > 1 ? "s" : ""})
              </summary>
              <div className="mt-3 grid gap-1.5">
                {rel.checksums.map((c) => (
                  <div key={c.name} className="min-w-0">
                    <p className="truncate font-mono text-[11.5px] text-foreground">{c.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{c.hash}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <div className="border-t border-border p-5 sm:p-6 lg:border-l lg:border-t-0">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            What you need
          </h3>
          <ul className="mt-3 space-y-2">
            {OS_REQUIREMENTS.map((r) => (
              <li key={r} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                {r}
              </li>
            ))}
          </ul>
          {rel?.screenshot && (
            <img
              src={rel.screenshot.url}
              alt={`${OS_NAME} desktop`}
              loading="lazy"
              className="mt-5 w-full rounded-xl border border-border object-cover"
            />
          )}
        </div>
      </div>
    </Card>
  );
}
