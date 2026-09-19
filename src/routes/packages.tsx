import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/packages")({
  head: () => ({ meta: [{ title: "NPM Packages — ZYRAXON AI" }] }),
  component: PackagesPage,
});

type Package = {
  name: string;
  scope: string;
  version: string;
  description: string;
  keywords: string[];
  date: string;
  npmUrl: string;
  installCmd: string;
};

const S = {
  bg: "#ffffff",
  bg2: "#f8f9fb",
  surface: "#ffffff",
  border: "rgba(0,0,0,.06)",
  border2: "rgba(0,0,0,.1)",
  accent: "#2563eb",
  accent2: "#7c3aed",
  accent3: "#06b6d4",
  green: "#10b981",
  text: "#111827",
  textSec: "#6b7280",
  textMuted: "#9ca3af",
  mono: "'JetBrains Mono','SF Mono','Fira Code',monospace",
  font: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
  shadow: "0 4px 16px rgba(0,0,0,.06)",
  shadowLg: "0 12px 40px rgba(0,0,0,.08)",
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        background: copied ? S.green : S.accent,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "6px 14px",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all .2s",
        whiteSpace: "nowrap" as const,
        flexShrink: 0,
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function PackageCard({ pkg }: { pkg: Package }) {
  return (
    <div
      style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
        transition: "all .25s",
        boxShadow: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = S.shadowLg;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = "rgba(37,99,235,.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = S.border;
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
        <span
          style={{
            fontFamily: S.mono,
            fontSize: 14,
            fontWeight: 700,
            color: S.accent,
          }}
        >
          {pkg.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: S.accent2,
            background: "rgba(124,58,237,.08)",
            padding: "2px 8px",
            borderRadius: 6,
          }}
        >
          v{pkg.version}
        </span>
      </div>

      <p style={{ fontSize: 13, color: S.textSec, margin: 0, lineHeight: 1.5, minHeight: 40 }}>
        {pkg.description || "No description"}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: S.bg2,
          border: `1px solid ${S.border}`,
          borderRadius: 10,
          padding: "10px 14px",
          fontFamily: S.mono,
          fontSize: 13,
          color: S.text,
          overflow: "hidden",
        }}
      >
        <span style={{ color: S.textMuted, userSelect: "none" }}>$</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {pkg.installCmd}
        </span>
        <CopyBtn text={pkg.installCmd} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{ fontSize: 11, color: S.textMuted }}>
          {new Date(pkg.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <a
          href={pkg.npmUrl}
          target="_blank"
          rel="noopener"
          style={{
            fontSize: 12,
            color: S.accent2,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          npmjs.com
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      </div>

      {pkg.keywords.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginTop: 4 }}>
          {pkg.keywords.slice(0, 4).map((kw) => (
            <span
              key={kw}
              style={{
                fontSize: 10,
                color: S.textMuted,
                background: S.bg2,
                border: `1px solid ${S.border}`,
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/public/npm-packages");
        const data = await res.json();
        if (active && data.packages) setPackages(data.packages);
        if (active && data.error) setError(data.error);
      } catch (e: any) {
        if (active) setError(e?.message || "Failed to load packages");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = packages.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div style={{ minHeight: "100vh", background: S.bg, fontFamily: S.font, color: S.text }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Back link */}
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: S.textMuted,
            marginBottom: 24,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to home
        </a>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 900,
              letterSpacing: "-.03em",
              margin: 0,
              color: S.text,
            }}
          >
            NPM <span style={{ color: S.accent }}>Packages</span>
          </h1>
          <p style={{ fontSize: 16, color: S.textSec, marginTop: 12, maxWidth: 560, marginInline: "auto" }}>
            Official {`@zyraxon-ai/*`} packages for building AI-powered applications.
          </p>

          {/* Quick install */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginTop: 24,
              background: S.bg2,
              border: `1px solid ${S.border}`,
              borderRadius: 12,
              padding: "12px 20px",
              fontFamily: S.mono,
              fontSize: 14,
              color: S.text,
            }}
          >
            <span style={{ color: S.textMuted }}>$</span>
            <span>npm install @zyraxon-ai/sdk</span>
            <CopyBtn text="npm install @zyraxon-ai/sdk" />
          </div>
        </div>

        {/* Search */}
        <div style={{ maxWidth: 480, margin: "0 auto 32px", position: "relative" }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={S.textMuted}
            strokeWidth="2"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search packages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px 12px 42px",
              background: S.surface,
              border: `1px solid ${S.border2}`,
              borderRadius: 12,
              fontSize: 14,
              color: S.text,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color .2s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = S.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = S.border2)}
          />
        </div>

        {/* Stats */}
        {!loading && (
          <div style={{ textAlign: "center", marginBottom: 24, fontSize: 13, color: S.textMuted }}>
            {packages.length} packages under {`@zyraxon-ai`}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: S.textSec }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: `3px solid ${S.border}`,
                borderTopColor: S.accent,
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            Loading packages...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              color: "#991b1b",
            }}
          >
            Failed to load packages: {error}
          </div>
        )}

        {/* Grid */}
        {!loading && !error && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((pkg) => (
              <PackageCard key={pkg.name} pkg={pkg} />
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && packages.length > 0 && (
          <div style={{ textAlign: "center", padding: 40, color: S.textMuted }}>
            No packages match "{search}"
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 48, paddingTop: 24, borderTop: `1px solid ${S.border}` }}>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: S.textMuted,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to ZYRAXON AI
          </a>
        </div>
      </div>
    </div>
  );
}
