import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { Icon } from "@/components/site/Icon";
import { CopyButton } from "@/components/site/provider-parts";
import { CLI_COMMANDS, CLI_PATH_COMMANDS, CLI_USAGE, GITHUB_REPO } from "@/lib/downloads";

const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

type Asset = { name: string; url: string; size: number | null; tag: string };
type Platforms = Record<string, Asset | null>;
type Resolved = {
  latest: { tag: string; url: string; repo: string } | null;
  assets: { name: string; size: number | null; url: string }[];
  platforms: Platforms;
  error?: string;
};

/** One family of buttons: the desktop app, the command line, the source. */
type Group = {
  key: string;
  label: string;
  blurb: string;
  icon: "monitor" | "code" | "layers";
  rows: { id: string; os: string; detail: string; ext: string }[];
};

const GROUPS: Group[] = [
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
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

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

      {/* The commands come first: most people who arrive here want the CLI, and
          a copy button beats a download for anyone who already has a terminal. */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="zx-glass grid h-9 w-9 place-items-center rounded-lg text-primary">
            <Icon name="code" size={17} />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Install in one command
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Run the line for your system. It fetches the newest command-line build from the release,
          unpacks it and prints the version — so a failed download is obvious straight away. Nothing
          in these archives carries the execute bit, which is why every Unix line runs{" "}
          <span className="font-mono">chmod +x</span> before it tries to run anything.
        </p>
        <div className="mt-4 grid gap-3">
          {CLI_COMMANDS.map((c) => (
            <div key={c.label}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </span>
                <CopyButton text={c.code} label="copy" />
              </div>
              <pre className="mt-1.5 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground">
                <code>{c.code}</code>
              </pre>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Put it on your PATH
            </h3>
            <div className="mt-2 grid gap-3">
              {CLI_PATH_COMMANDS.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {c.label}
                    </span>
                    <CopyButton text={c.code} label="copy" />
                  </div>
                  <pre className="mt-1.5 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground">
                    <code>{c.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Once it is installed
            </h3>
            <div className="mt-2 grid gap-3">
              {CLI_USAGE.map((c) => (
                <div key={c.label}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {c.label}
                    </span>
                    <CopyButton text={c.code} label="copy" />
                  </div>
                  <pre className="mt-1.5 overflow-x-auto rounded-lg bg-foreground/5 px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground">
                    <code>{c.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                    {available ? (
                      <ButtonAnchor
                        href={`/api/download/${row.id}`}
                        external={false}
                        variant="glass"
                        size="sm"
                        className="w-full"
                      >
                        Download {row.ext}
                      </ButtonAnchor>
                    ) : (
                      <span className="block text-center text-[12px] text-muted-foreground">
                        {state === "loading" ? "Checking…" : "Not in this release"}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Card className="mt-8 p-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          Every file in this release
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {assetCount > 0
            ? `All ${assetCount} files attached to ${tag}, each one a direct download.`
            : "The list appears once the release is read."}
        </p>
        {assetCount > 0 && (
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
