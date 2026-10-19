import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/apps", label: "Apps" },
  { to: "/ecosystem", label: "Ecosystem" },
  { to: "/docs", label: "Docs" },
  { to: "/packages", label: "Packages" },
  { to: "/extensions", label: "Extensions" },
  { to: "/releases", label: "Releases" },
  { to: "/demo", label: "Demo" },
  { to: "/community-art", label: "Community" },
  { to: "/faq", label: "FAQ" },
] as const;

const MORE = [
  { to: "/builder", label: "Builder" },
  { to: "/providers", label: "Providers" },
  { to: "/bludar", label: "Bludar Studio" },
  { to: "/nebula", label: "Nebula" },
  { to: "/publish", label: "Publish" },
  { to: "/updates", label: "Updates" },
  { to: "/zsl", label: "ZSL License" },
  { to: "/desktop-feedback", label: "Desktop Feedback" },
  { to: "/privacy-policy", label: "Privacy" },
] as const;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`zx-chip grid h-9 w-9 place-items-center rounded-full text-foreground ${className}`}
    >
      {dark ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.2A8.4 8.4 0 019.8 4a8.5 8.5 0 1010.2 10.2z" />
        </svg>
      )}
    </button>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="zx-glass grid h-9 w-9 place-items-center overflow-hidden rounded-xl">
        <img src="/zyraxon-logo.png" alt="" width={26} height={26} className="object-contain" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-tight text-foreground">ZYRAXON</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          AI Platform
        </span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={`zx-glass-strong mx-auto flex max-w-7xl items-center gap-3 rounded-2xl px-3 py-2.5 transition-shadow sm:px-4 ${
          scrolled ? "shadow-lg" : ""
        }`}
      >
        <Wordmark />

        <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                isActive(item.to)
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMore((v) => !v)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              More
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {more && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMore(false)} />
                <div className="zx-glass-strong absolute right-0 z-20 mt-2 w-52 rounded-xl p-1.5">
                  {MORE.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="block rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/onelpawarai-X/ZYRAXON-AI"
            target="_blank"
            rel="noopener noreferrer"
            className="zx-chip hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-foreground sm:flex"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7 0-.7 0-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3z" />
            </svg>
            GitHub
          </a>
          <Link
            to="/download/zyraxon-agent"
            className="zx-chip zx-sheen hidden h-9 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground sm:flex"
          >
            Download
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="zx-chip grid h-9 w-9 place-items-center rounded-full text-foreground lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="zx-glass-strong mx-auto mt-2 max-w-7xl rounded-2xl p-3 lg:hidden">
          <div className="grid grid-cols-2 gap-1.5">
            {[...NAV, ...MORE].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <Link
            to="/download/zyraxon-agent"
            className="mt-2 block rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-semibold text-primary-foreground"
          >
            Download ZYRAXON Agent
          </Link>
        </div>
      )}
    </header>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: readonly { to: string; label: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 px-3 pb-6 sm:px-5">
      <div className="zx-glass-strong mx-auto max-w-7xl rounded-2xl px-6 py-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              All in one. Anything. Nothing is impossible. A source-available desktop AI agent
              that acts, builds, and ships.
            </p>
          </div>
          <FooterCol
            title="Platform"
            links={[
              { to: "/apps", label: "Apps" },
              { to: "/ecosystem", label: "Ecosystem" },
              { to: "/packages", label: "Packages" },
              { to: "/extensions", label: "Extensions" },
              { to: "/releases", label: "Releases" },
              { to: "/docs", label: "Documentation" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { to: "/community-art", label: "Community" },
              { to: "/updates", label: "Updates" },
              { to: "/faq", label: "FAQ" },
              { to: "/desktop-feedback", label: "Desktop Feedback" },
              { to: "/privacy-policy", label: "Privacy Policy" },
            ]}
          />
          <FooterCol
            title="Products"
            links={[
              { to: "/builder", label: "AI Builder" },
              { to: "/bludar", label: "Bludar Studio" },
              { to: "/nebula", label: "Nebula" },
              { to: "/publish", label: "Publish" },
              { to: "/zsl", label: "ZSL License" },
            ]}
          />
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">© {year} ZYRAXON AI. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a
              href="https://github.com/onelpawarai-X/ZYRAXON-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href="https://github.com/onelpawarai-X/ZYRAXON-AI/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Issues
            </a>
            <Link to="/zsl" className="transition-colors hover:text-foreground">
              License
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * The single floating glass sheet every page renders inside. The plane behind
 * it stays pure white (light) or pure black (dark), so the sheet reads as a
 * physical object hovering above the page.
 */
export function GlassPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--plane)] px-3 py-3 sm:px-5 sm:py-4">
      <div className="mx-auto max-w-7xl">
        <div className="zx-sheet">{children}</div>
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{children}</p>;
}

export function PageHeader({
  label,
  title,
  description,
  children,
}: {
  label?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {label && <SectionLabel>{label}</SectionLabel>}
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
