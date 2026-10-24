/** The total download count, as a button at the top of the homepage.
 *
 *  GitHub does not publish a repository-wide download total, so the number is
 *  the sum of `download_count` over every asset of every release. It sits in the
 *  header strip rather than in a section because it is a fact about the
 *  project, not a pitch: a visitor should be able to see it without scrolling
 *  and without it competing with the download call to action below. */
import { useEffect, useState } from "react";

export function DownloadCounter() {
  const [downloads, setDownloads] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/public/repo-stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d && typeof d.downloads === "number") setDownloads(d.downloads);
        })
        .catch(() => {});
    void load();
    const id = window.setInterval(load, 120_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <a
      href="#download"
      className="zx-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      title="Total downloads across every release"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        aria-hidden
      >
        <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16" />
      </svg>
      <span className="tabular-nums">
        {downloads === null ? "—" : downloads.toLocaleString("en-US")}
      </span>
      <span className="font-medium">downloads</span>
    </a>
  );
}
