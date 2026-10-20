import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { Icon } from "@/components/site/Icon";

const GITHUB_REPO = "onelpawarai-X/ZYRAXON-AI";
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

type PlatformKey =
  | "windows"
  | "windows-arm64"
  | "mac-arm"
  | "mac-intel"
  | "linux-appimage"
  | "linux-deb"
  | "linux-rpm";

type Asset = { name: string; url: string; size: number; tag: string };

type Platforms = Partial<Record<PlatformKey, Asset | null>>;

type Resolved = {
  latest: { tag: string; url: string; publishedAt: string | null } | null;
  platforms: Platforms;
};

const BUTTONS: { key: PlatformKey; os: string; file: string; detail: string }[] = [
  {
    key: "windows",
    os: "Windows",
    file: ".exe",
    detail: "Windows 10/11 (x64)",
  },
  {
    key: "windows-arm64",
    os: "Windows on ARM",
    file: ".exe",
    detail: "Surface Pro X, Snapdragon laptops",
  },
  {
    key: "mac-arm",
    os: "macOS",
    file: ".dmg",
    detail: "macOS 12+ · Apple Silicon (M-series)",
  },
  {
    key: "mac-intel",
    os: "macOS",
    file: ".dmg",
    detail: "macOS 12+ · Intel chips",
  },
  {
    key: "linux-appimage",
    os: "Linux",
    file: ".AppImage",
    detail: "Any distro · no install needed",
  },
  {
    key: "linux-deb",
    os: "Linux",
    file: ".deb",
    detail: "Debian / Ubuntu",
  },
  {
    key: "linux-rpm",
    os: "Linux",
    file: ".rpm",
    detail: "Fedora / RHEL / openSUSE",
  },
];

function formatSize(bytes?: number) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`;
}

export const Route = createFileRoute("/download/zyraxon-agent")({
  head: () => ({
    meta: [
      { title: "Download ZYRAXON Agent" },
      {
        name: "description",
        content:
          "Download the latest ZYRAXON Agent for Windows, macOS or Linux. Free, source-available desktop AI agent with 888 tools. Direct downloads from the newest release.",
      },
      {
        name: "keywords",
        content: "download ZYRAXON, ZYRAXON Agent installer, Windows macOS Linux AI agent",
      },
      { property: "og:title", content: "Download ZYRAXON Agent" },
      {
        property: "og:description",
        content:
          "Download the latest ZYRAXON Agent for Windows, macOS or Linux. Free, source-available desktop AI agent.",
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

  const latestTag = data?.latest?.tag;

  return (
    <PageShell>
      <PageHeader
        label="Download"
        title="ZYRAXON Agent"
        description={
          state === "loading"
            ? "Finding the newest release and its installers…"
            : state === "ready"
              ? "Direct downloads from the newest release. The button saves the file; it does not open a page."
              : "Could not read the release list right now. Use the releases page as a fallback."
        }
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {latestTag ? (
            <Tag tone="success">Latest release {latestTag}</Tag>
          ) : (
            <Tag tone="muted">{state === "loading" ? "Checking releases…" : "Releases"}</Tag>
          )}
          {data?.latest?.publishedAt && (
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              published {new Date(data.latest.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BUTTONS.map((b) => {
          const asset = data?.platforms?.[b.key];
          const available = Boolean(asset?.url);
          return (
            <Card key={`${b.os}-${b.file}`} hover className="flex flex-col p-6">
              <span className="zx-glass grid h-12 w-12 place-items-center rounded-xl text-primary">
                <Icon name="monitor" size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{b.os}</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">{b.detail}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {b.file}
                {asset?.size ? ` · ${formatSize(asset.size)}` : ""}
              </p>
              <div className="mt-5">
                {available ? (
                  <ButtonAnchor
                    href={`/api/download/${b.key}`}
                    external={false}
                    variant="glass"
                    size="sm"
                  >
                    Download {b.file}
                  </ButtonAnchor>
                ) : (
                  <ButtonAnchor href={RELEASES_URL} variant="glass" size="sm">
                    View on releases
                  </ButtonAnchor>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonAnchor href={RELEASES_URL} size="md">
          All releases
        </ButtonAnchor>
        <ButtonAnchor href="/docs" external={false} variant="glass" size="md">
          Read the docs
        </ButtonAnchor>
      </div>
    </PageShell>
  );
}
