import { useEffect, useState } from "react";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { Icon } from "@/components/site/Icon";
import {
  OS_BLURB,
  OS_DETAIL,
  OS_ID,
  OS_NAME,
  OS_RELEASES_URL,
  formatBytes,
} from "@/lib/os-download";

type OsAsset = { name: string; url: string; size: number | null };
type OsData = {
  latest: { tag: string } | null;
  release: {
    tag: string;
    isLatest: boolean;
    iso: OsAsset;
    sha256: string | null;
  } | null;
  error?: string;
};

/**
 * One fetch of the newest ZyraxonOS release, shared by every place the homepage
 * offers it.
 *
 * The homepage shows the OS in more than one spot — the download band and the
 * section near the foot — and both must name the same tag and offer the same
 * file. They read this hook rather than fetching separately, so they cannot
 * disagree, and a failure is silent: the button still links to
 * `/api/download/zyraxon-os`, which resolves on click and falls back to the
 * releases page. The OS is never a dead end, only an unlabelled one.
 */
function useOsRelease(): OsData | null {
  const [os, setOs] = useState<OsData | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/os")
      .then((r) => r.json())
      .then((json: OsData) => {
        if (!cancelled) setOs(json);
      })
      .catch(() => {
        /* the button links to the releases page instead */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return os;
}

/**
 * The compact OS download card.
 *
 * One file, one button. The image is a single `.iso` — the resolver only ever
 * answers with a real ISO file, stepping back to the newest release that carries
 * one — so there is nothing to explain and nothing else to click: the button
 * saves the file, and the size and tag beside it come from the same fetch.
 */
export function OsDownloadCard({ className = "" }: { className?: string }) {
  const os = useOsRelease();
  const rel = os?.release ?? null;

  return (
    <Card hover className={`flex flex-col p-6 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="zx-glass grid h-11 w-11 place-items-center rounded-xl text-primary">
          <Icon name="layers" size={20} />
        </span>
        <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{OS_NAME}</h3>
        {rel?.tag ? (
          <Tag tone="success">
            {rel.isLatest ? "Newest release" : "Latest with an ISO"} {rel.tag}
          </Tag>
        ) : (
          <Tag tone="muted">{os?.error ? "Release unread" : "Checking…"}</Tag>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{OS_BLURB}</p>
      <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">
        {OS_DETAIL}
        {rel?.iso?.size ? ` · ${formatBytes(rel.iso.size)}` : ""}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        <ButtonAnchor href={`/api/download/${OS_ID}`} external={false} variant="primary" size="sm">
          Download {OS_NAME}
        </ButtonAnchor>
        <ButtonAnchor href={OS_RELEASES_URL} variant="glass" size="sm">
          Release notes
        </ButtonAnchor>
      </div>
    </Card>
  );
}
