import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";

/**
 * Standard page frame: glass header, one floating glass sheet holding the page
 * body, glass footer. The plane behind stays pure white (light) or pure black
 * (dark), which is what makes the sheet read as a hovering pane of glass.
 */
export function PageShell({
  children,
  contentClassName = "px-6 py-10 sm:px-10 sm:py-14",
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--plane)]">
      <SiteHeader />
      <main className="px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-7xl">
          <div className="zx-sheet">
            <div className={contentClassName}>{children}</div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Full-bleed variant for pages that embed a studio/iframe (no padding). */
export function FullBleedShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--plane)]">
      <SiteHeader />
      <main className="px-3 pt-4 sm:px-5 sm:pt-5">
        <div className="mx-auto max-w-7xl">
          <div className="zx-sheet overflow-hidden">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
