import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const BTN_BASE =
  "zx-sheen inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:opacity-50";

const BTN_VARIANTS = {
  primary:
    "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30",
  glass: "zx-chip text-foreground hover:-translate-y-0.5",
  ghost: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
  outline: "border border-border bg-transparent text-foreground hover:bg-foreground/5",
} as const;

const BTN_SIZES = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
} as const;

type ButtonProps = {
  children: ReactNode;
  variant?: keyof typeof BTN_VARIANTS;
  size?: keyof typeof BTN_SIZES;
  className?: string;
};

export function ButtonLink({
  to,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: ButtonProps & { to: string }) {
  return (
    <Link to={to} className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}>
      {children}
    </Link>
  );
}

export function ButtonAnchor({
  href,
  children,
  variant = "glass",
  size = "md",
  className = "",
  external = true,
}: ButtonProps & { href: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
    >
      {children}
    </a>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}

/** Rounded glass panel used for every content block on the site. */
export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`zx-glass rounded-2xl ${hover ? "zx-sheen transition-transform duration-200 hover:-translate-y-0.5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="zx-glass rounded-2xl px-4 py-3.5 text-center">
      <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" | "success" | "warn" }) {
  const tones = {
    muted: "bg-foreground/6 text-muted-foreground",
    primary: "bg-primary/12 text-primary",
    success: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/14 text-amber-700 dark:text-amber-400",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Section({
  id,
  label,
  title,
  description,
  children,
  className = "",
}: {
  id?: string;
  label?: string;
  title?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      {(label || title || description) && (
        <div className="mb-6">
          {label && (
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
              {label}
            </p>
          )}
          {title && (
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h2>
          )}
          {description && (
            <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function Divider() {
  return <div className="my-10 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />;
}
