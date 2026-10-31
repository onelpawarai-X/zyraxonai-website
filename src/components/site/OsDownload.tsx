import { useEffect, useState } from "react";
import { ButtonAnchor, Card, Tag } from "@/components/site/ui";
import { Icon } from "@/components/site/Icon";
import { CommandBox } from "@/components/site/provider-parts";
import {
  OS_BLURB,
  OS_DETAIL,
  OS_ID,
  OS_NAME,
  OS_RELEASES_URL,
  formatBytes,
  osFetchScript,
} from "@/lib/os-download";

type OsAsset = { name: string; url: string; size: number | null };
type OsData = {
  latest: { tag: string } | null;
  release: {
    tag: string;
    primary: OsAsset | null;
    parts: OsAsset[];
    split: boolean;
    isoName: string | null;
    isoSha256: string | null;
    totalBytes: number | null;
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
 * A single-file release is one button. The current image is not one file: it is
 * over GitHub's 2 GB per-asset limit, so it is published as parts and there is no
 * ISO to click at all. The card says that in as many words and hands over one
 * command that fetches every part, rejoins them and checks the published hash —
 * because "why is this part00 and not an ISO" is the question a visitor actually
 * arrives with, and a bare `cat` line does not answer it.
 */
export function OsDownloadCard({ className = "" }: { className?: string }) {
  const os = useOsRelease();
  const rel = os?.release ?? null;
  const parts = rel?.parts ?? [];
  const script =
    rel?.split && rel.isoName
      ? osFetchScript(
          rel.tag,
          rel.isoName,
          parts.map((p) => p.name),
          rel.isoSha256,
        )
      : "";

  return (
    <Card hover className={`flex flex-col p-6 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="zx-glass grid h-11 w-11 place-items-center rounded-xl text-primary">
          <Icon name="layers" size={20} />
        </span>
        <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{OS_NAME}</h3>
        {rel?.tag ? (
          <Tag tone="success">Newest release {rel.tag}</Tag>
        ) : (
          <Tag tone="muted">{os?.error ? "Release unread" : "Checking…"}</Tag>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{OS_BLURB}</p>
      <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">
        {OS_DETAIL}
        {rel?.totalBytes ? ` · ${formatBytes(rel.totalBytes)}` : ""}
      </p>

      {/* The one question a visitor actually has. The latest image is over
          GitHub's 2 GB per-asset limit, so it is published as parts and there is
          no single file to click. Saying that plainly — and handing over one
          command that fetches, rejoins and checks them — is the difference
          between "the site is broken" and "this is how a big image ships". */}
      {rel?.split && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5">
          <p className="text-[12.5px] font-semibold text-foreground">
            One command gets the whole ISO
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            {rel.isoName} is {formatBytes(rel.totalBytes)}, over GitHub&apos;s 2 GB per-file limit,
            so it is published as {parts.length} parts. This downloads every part, rejoins them into
            the ISO and verifies it.
          </p>
          <div className="mt-2.5">
            <CommandBox code={script} label="copy command" />
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        <ButtonAnchor href={`/api/download/${OS_ID}`} external={false} variant="primary" size="sm">
          {rel?.split ? `Download part 1 of ${parts.length}` : "Download .iso"}
        </ButtonAnchor>
        <ButtonAnchor href={OS_RELEASES_URL} variant="glass" size="sm">
          Release notes
        </ButtonAnchor>
      </div>
    </Card>
  );
}
