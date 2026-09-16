import { useState, useEffect } from "react";

const ENDPOINT = "https://agent-ecosystem-hub.lovable.app/api/public/v1";

interface PublishedApp {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  source_agent: string;
  author_name: string;
  cover_url: string;
  live_url: string;
  repo_url: string;
  version: string;
  tags: string[];
  published_at: string;
  scan?: { score: number; blocked: boolean; findings: string[] };
}

const AGENT_COLORS: Record<string, string> = {
  cloud: "#2563eb",
  desktop: "#7c3aed",
  mobile: "#f59e0b",
  code: "#059669",
};

export const PublishedApps: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [apps, setApps] = useState<PublishedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${ENDPOINT}/apps`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setApps(d); else if (d?.apps) setApps(d.apps); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: compact ? 20 : 40, color: "#9ca3af", fontSize: 13 }}>Loading published apps...</div>
  );

  if (apps.length === 0) return (
    <div style={{ textAlign: "center", padding: compact ? 20 : 40, border: "1px dashed #d1d5db", borderRadius: 12, color: "#9ca3af", fontSize: 13 }}>
      No published apps yet. Be the first to publish!
    </div>
  );

  if (compact) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {apps.slice(0, 6).map((app) => (
          <div key={app.slug} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 16, transition: "box-shadow 0.15s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#f3f4f6", color: "#6b7280", textTransform: "capitalize" }}>{app.category}</span>
              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${AGENT_COLORS[app.source_agent] || "#6b7280"}15`, color: AGENT_COLORS[app.source_agent] || "#6b7280" }}>{app.source_agent}</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>{app.name}</h4>
            {app.tagline && <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.4 }}>{app.tagline}</p>}
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>by {app.author_name || "Anonymous"} {app.version && `v${app.version}`}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {apps.map((app) => (
          <div key={app.slug} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", overflow: "hidden" }}>
            {app.cover_url && (
              <div style={{ height: 140, overflow: "hidden", background: "#f3f4f6" }}>
                <img src={app.cover_url} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#f3f4f6", color: "#6b7280", textTransform: "capitalize" }}>{app.category}</span>
                <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${AGENT_COLORS[app.source_agent] || "#6b7280"}15`, color: AGENT_COLORS[app.source_agent] || "#6b7280" }}>{app.source_agent}</span>
                {app.version && <span style={{ fontSize: 11, color: "#9ca3af" }}>v{app.version}</span>}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{app.name}</h3>
              {app.tagline && <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 8px" }}>{app.tagline}</p>}
              <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 12px" }}>by {app.author_name || "Anonymous"}</p>
              {app.tags && app.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {app.tags.slice(0, 5).map((t) => (
                    <span key={t} style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#f3f4f6", color: "#6b7280" }}>{t}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {app.live_url && (
                  <a href={app.live_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "5px 12px", borderRadius: 6, background: "#059669", color: "white", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Live</a>
                )}
                {app.repo_url && (
                  <a href={app.repo_url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontSize: 12, textDecoration: "none" }}>GitHub</a>
                )}
                {app.scan && (
                  <span style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: app.scan.blocked ? "#dc2626" : "#059669", background: app.scan.blocked ? "#fef2f2" : "#f0fdf4" }}>
                    Score: {app.scan.score}/100
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
