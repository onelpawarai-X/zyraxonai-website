import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";

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
        background: copied ? "#10b981" : "rgba(0,245,255,.1)",
        border: `1px solid ${copied ? "#10b981" : "rgba(0,245,255,.2)"}`,
        color: copied ? "#fff" : "#00f5ff",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all .2s",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function PackageCard({ pkg }: { pkg: Package }) {
  const shortName = pkg.name.replace(`@${pkg.scope || "zyraxon-ai"}/`, "");
  const isCore = ["sdk", "client", "server", "core", "llm"].includes(shortName);
  const isInfra = ["schema", "protocol", "plugin"].includes(shortName);

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        background: isCore
          ? "linear-gradient(135deg, rgba(0,245,255,.04), rgba(124,58,237,.04))"
          : isInfra
          ? "linear-gradient(135deg, rgba(124,58,237,.04), rgba(236,72,153,.04))"
          : "rgba(255,255,255,.02)",
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
        transition: "all .3s",
        position: "relative" as const,
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(0,245,255,.25)";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,245,255,.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,.08)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {isCore && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "linear-gradient(135deg, #00f5ff, #7c3aed)",
            color: "#000",
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 6,
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px",
          }}
        >
          Core
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 15,
            fontWeight: 700,
            color: "#00f5ff",
          }}
        >
          {pkg.name}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#7c3aed",
            background: "rgba(124,58,237,.12)",
            padding: "2px 8px",
            borderRadius: 6,
          }}
        >
          v{pkg.version}
        </span>
      </div>

      <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>
        {pkg.description || "No description"}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(0,0,0,.3)",
          border: "1px solid rgba(255,255,255,.06)",
          borderRadius: 8,
          padding: "8px 12px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          color: "#e5e7eb",
          overflow: "hidden",
        }}
      >
        <span style={{ color: "#6b7280", userSelect: "none" }}>$</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {pkg.installCmd}
        </span>
        <CopyBtn text={pkg.installCmd} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>
          Published {new Date(pkg.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <a
          href={pkg.npmUrl}
          target="_blank"
          rel="noopener"
          style={{
            fontSize: 12,
            color: "#7c3aed",
            fontWeight: 600,
            textDecoration: "none",
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
                color: "#6b7280",
                background: "rgba(255,255,255,.04)",
                border: "1px solid rgba(255,255,255,.06)",
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div
      style={{
        minHeight: "100vh",
        background: "#06060e",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#f0f0f5",
      }}
    >
      {/* Ambient BG */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "rgba(0,245,255,.06)",
            filter: "blur(120px)",
            top: "-200px",
            right: "-100px",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "rgba(124,58,237,.06)",
            filter: "blur(120px)",
            bottom: "-150px",
            left: "-100px",
          }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48, textAlign: "center" }}>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "#7a7a95",
              textDecoration: "none",
              marginBottom: 24,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to home
          </a>

          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              margin: 0,
              background: "linear-gradient(135deg, #00f5ff 0%, #a855f7 50%, #ec4899 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            NPM Packages
          </h1>
          <p style={{ fontSize: 16, color: "#7a7a95", marginTop: 12, maxWidth: 600, marginInline: "auto" }}>
            Official {`@zyraxon-ai/*`} packages for building AI-powered applications.
            <br />
            All packages are open-source and published to npm.
          </p>

          {/* Quick install */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 24,
              background: "rgba(0,0,0,.4)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 10,
              padding: "10px 16px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              color: "#e5e7eb",
            }}
          >
            <span style={{ color: "#6b7280" }}>$</span>
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
            stroke="#4a4a65"
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
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 12,
              fontSize: 14,
              color: "#f0f0f5",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Stats */}
        {!loading && (
          <div style={{ textAlign: "center", marginBottom: 24, fontSize: 13, color: "#6b7280" }}>
            {packages.length} packages published under {`@zyraxon-ai`}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#7a7a95" }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid rgba(0,245,255,.2)",
                borderTopColor: "#00f5ff",
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
              background: "rgba(239,68,68,.06)",
              border: "1px solid rgba(239,68,68,.15)",
              borderRadius: 12,
              color: "#fca5a5",
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
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((pkg) => (
              <PackageCard key={pkg.name} pkg={pkg} />
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && packages.length > 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
            No packages match "{search}"
          </div>
        )}

        {/* Footer link */}
        <div style={{ textAlign: "center", marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: "#7a7a95",
              textDecoration: "none",
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
