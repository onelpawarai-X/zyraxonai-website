import { useEffect, useState } from "react";
import { SectionLabel } from "@/components/site/SiteChrome";
import { Card, Tag } from "@/components/site/ui";

/**
 * The walkthroughs published as release assets in the studio repository.
 *
 * Nothing here is hand-listed: the endpoint reads the studio's release tags,
 * keeps the video files and returns a playlist, so uploading a new clip to a new
 * release is the whole publishing step. Until the studio publishes one, the
 * section says so rather than showing an empty box.
 */

type Clip = {
  tag: string;
  name: string;
  publishedAt: string | null;
  size: number | null;
  src: string;
  download: string;
};

/** A readable title, from the file name the studio uploaded. */
function titleOf(name: string): string {
  return name
    .replace(/\.(mp4|webm|mov|m4v)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A file size a person can read. */
function sizeOf(bytes: number | null): string | null {
  if (!bytes) return null;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The release date, as a day. */
function dateOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ReleaseClips() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    // `no-store` on the client so a visitor who reloads right after an upload
    // sees it; the endpoint itself holds a short shared cache for the burst.
    fetch("/api/public/demo-videos")
      .then((r) => (r.ok ? r.json() : { clips: [] }))
      .then((d) => alive && setClips(d.clips ?? []))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="mt-12">
        <SectionLabel>From the studio</SectionLabel>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="zx-glass aspect-video animate-pulse rounded-2xl" />
          <div className="zx-glass aspect-video animate-pulse rounded-2xl" />
        </div>
      </section>
    );
  }

  if (!clips.length) {
    return (
      <section className="mt-12">
        <SectionLabel>From the studio</SectionLabel>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          New walkthroughs land here
        </h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          Every video published as a release in the studio repository appears on this page on its
          own, with no change to the site. There is no clip published yet.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <SectionLabel>From the studio</SectionLabel>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        Every walkthrough, straight from the releases
      </h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        These are read from the studio repository's release tags, newest first. Publish a video on a
        new release and it shows up here by itself.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {clips.map((clip) => (
          <Card key={`${clip.tag}-${clip.name}`} className="overflow-hidden p-0">
            <video
              src={clip.src}
              controls
              preload="metadata"
              playsInline
              className="aspect-video w-full bg-black object-cover"
            />
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-foreground">
                  {titleOf(clip.name)}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Tag tone="primary">{clip.tag}</Tag>
                  {dateOf(clip.publishedAt) && <Tag>{dateOf(clip.publishedAt)}</Tag>}
                  {sizeOf(clip.size) && <Tag>{sizeOf(clip.size)}</Tag>}
                </div>
              </div>
              <a
                href={clip.download}
                className="text-[12px] font-semibold text-primary underline underline-offset-2"
              >
                Download →
              </a>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
