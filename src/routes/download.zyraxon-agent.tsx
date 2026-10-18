import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { DOWNLOADS } from "@/lib/home-content";

const GITHUB_REPO = "onelpawarai-X/ZYRAXON-AI";

export const Route = createFileRoute("/download/zyraxon-agent")({
  head: () => ({
    meta: [
      { title: "Download ZYRAXON Agent" },
      {
        name: "description",
        content:
          "Download the latest ZYRAXON Agent for Windows, macOS or Linux. Free, source-available desktop AI agent with 805+ tools.",
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
  }),
  component: DownloadZyraxonAgent,
});

const NOISE = /\.blockmap$|\.ya?ml$|\.sha\d*$|\.sig$|\.txt$|^latest/i;

function pickAsset(assets: { name: string; browser_download_url: string }[]) {
  const ua = (navigator.userAgent || "") + " " + (navigator.platform || "");
  let os = "windows";
  if (/mac|iphone|ipad/i.test(ua)) os = "mac";
  else if (/linux|x11/i.test(ua)) os = "linux";

  const patterns: Record<string, RegExp[]> = {
    windows: [/win.*\.exe$/i, /setup.*\.exe$/i, /\.exe$/i],
    mac: [/(mac|osx|darwin).*(arm64|aarch64)/i, /-arm64/i, /\.dmg$/i],
    linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i],
  };

  const clean = assets.filter((a) => !NOISE.test(a.name));
  for (const pat of patterns[os] ?? patterns.windows) {
    const hit = clean.find((a) => pat.test(a.name));
    if (hit) return hit.browser_download_url;
  }
  return null;
}

function DownloadZyraxonAgent() {
  const [status, setStatus] = useState<"starting" | "redirecting" | "fallback">("starting");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`,
          { headers: { Accept: "application/vnd.github+json" } },
        );
        if (!res.ok) throw new Error("release lookup failed");
        const releases = await res.json();
        const assets = (Array.isArray(releases) ? releases : [])
          .filter((r: { draft?: boolean }) => !r.draft)
          .flatMap(
            (r: { assets?: { name: string; browser_download_url: string }[] }) => r.assets ?? [],
          );
        const url = pickAsset(assets);
        if (cancelled) return;
        if (!url) throw new Error("no asset");
        setStatus("redirecting");
        window.location.href = url;
        window.setTimeout(() => {
          if (!cancelled) window.location.href = `https://github.com/${GITHUB_REPO}/releases`;
        }, 2500);
      } catch {
        if (cancelled) return;
        setStatus("fallback");
        window.setTimeout(() => {
          if (!cancelled) window.location.href = `https://github.com/${GITHUB_REPO}/releases`;
        }, 1200);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell>
      <PageHeader
        label="Download"
        title="ZYRAXON Agent"
        description={
          status === "fallback"
            ? "We could not find a matching installer automatically. Opening the releases page instead."
            : "Your download is starting. If nothing happens, choose your platform below."
        }
      >
        <div className="mt-4">
          <Tag tone={status === "fallback" ? "warn" : "success"}>
            {status === "fallback" ? "Opening releases…" : "Preparing your download…"}
          </Tag>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {DOWNLOADS.map((d) => (
          <Card key={d.os} hover className="p-6 text-center">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">{d.os}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">{d.detail}</p>
            <div className="mt-5">
              <ButtonAnchor
                href={`https://github.com/${GITHUB_REPO}/releases`}
                variant="glass"
                size="sm"
              >
                Download {d.file}
              </ButtonAnchor>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonAnchor href={`https://github.com/${GITHUB_REPO}/releases`} size="md">
          All releases
        </ButtonAnchor>
        <ButtonAnchor href="/docs" external={false} variant="glass" size="md">
          Read the docs
        </ButtonAnchor>
      </div>
    </PageShell>
  );
}
