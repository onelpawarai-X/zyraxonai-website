import { useState } from "react";
import { EcosystemItem, Comment } from "../../lib/ecosystem";
import { LikeButton } from "./LikeButton";
import { ShareButton } from "./ShareButton";
import { CommentSection } from "./CommentSection";

interface DetailModalProps {
  item: EcosystemItem | null;
  onClose: () => void;
  onInstall?: (item: EcosystemItem) => void;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

const renderStars = (rating: number) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        style={{ color: i <= Math.round(rating) ? "#e3b341" : "#e5e7eb", fontSize: "14px" }}
      >
        ★
      </span>,
    );
  }
  return stars;
};

const TYPE_COLORS: Record<string, string> = {
  bot: "#8957e5",
  plugin: "#047857",
  template: "#4f46e5",
  theme: "#a371f7",
  model: "#dc2626",
  tool: "#047857",
  cli: "#047857",
  sdk: "#4f46e5",
  extension: "#dc2626",
  app: "#8957e5",
  "desktop-app": "#047857",
  workflow: "#4f46e5",
  "ui-kit": "#a371f7",
  snippet: "#6b7280",
  devops: "#047857",
  font: "#6b7280",
  "landing-page": "#4f46e5",
  iso: "#dc2626",
  startkit: "#4f46e5",
  api: "#4f46e5",
  dataset: "#dc2626",
  prompt: "#8957e5",
  book: "#e3b341",
  pdf: "#dc2626",
  icon: "#a371f7",
  component: "#4f46e5",
};

const getButtonConfig = (item: EcosystemItem) => {
  const cat = item.category;
  if (cat === "plugins")
    return {
      label: "Install Plugin",
      color: "#047857",
      hover: "#059669",
      action: "install" as const,
    };
  if (cat === "ai-bots")
    return { label: "Add Bot", color: "#8957e5", hover: "#a371f7", action: "install" as const };
  if (cat === "website-templates")
    return { label: "Use Template", color: "#4f46e5", hover: "#6366f1", action: "live" as const };
  if (cat === "ai-models")
    return {
      label: "Download Model",
      color: "#dc2626",
      hover: "#ef4444",
      action: "download" as const,
    };
  if (cat === "browser-extensions")
    return {
      label: "Add Extension",
      color: "#dc2626",
      hover: "#ef4444",
      action: "download" as const,
    };
  if (cat === "themes")
    return { label: "Apply Theme", color: "#8957e5", hover: "#a371f7", action: "install" as const };
  if (cat === "workflows")
    return {
      label: "Import Workflow",
      color: "#4f46e5",
      hover: "#6366f1",
      action: "install" as const,
    };
  if (cat === "desktop-apps")
    return {
      label: "Download App",
      color: "#047857",
      hover: "#059669",
      action: "download" as const,
    };
  if (cat === "mobile-apps")
    return { label: "Get App", color: "#8957e5", hover: "#a371f7", action: "live" as const };
  if (item.installCommand)
    return { label: "Install", color: "#047857", hover: "#059669", action: "install" as const };
  if (item.liveDemo)
    return { label: "View Live", color: "#4f46e5", hover: "#6366f1", action: "live" as const };
  if (item.downloadUrl)
    return { label: "Download", color: "#047857", hover: "#059669", action: "download" as const };
  if (item.githubRepo)
    return { label: "View Source", color: "#f3f4f6", hover: "#e5e7eb", action: "github" as const };
  return { label: "View", color: "#f3f4f6", hover: "#e5e7eb", action: "view" as const };
};

export const DetailModal: React.FC<DetailModalProps> = ({ item, onClose, onInstall }) => {
  const [actionDone, setActionDone] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);

  if (!item) return null;

  const btn = getButtonConfig(item);
  const typeColor = TYPE_COLORS[item.type] || "#6366f1";

  const handleInstall = () => {
    if (item.installCommand) {
      navigator.clipboard
        .writeText(item.installCommand)
        .then(() => {
          setActionDone(true);
          setTimeout(() => setActionDone(false), 2000);
        })
        .catch(() => {});
      return;
    }
    if (item.downloadUrl) {
      window.open(item.downloadUrl, "_blank");
      return;
    }
    if (item.liveDemo) {
      window.open(item.liveDemo, "_blank");
      return;
    }
    if (item.githubRepo) {
      window.open(item.githubRepo, "_blank");
      return;
    }
    if (onInstall) onInstall(item);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.04)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(243,244,246,0.55)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 48px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#f0f6fc",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.name}
            </h2>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: "600",
                textTransform: "capitalize",
                flexShrink: 0,
                background: `${typeColor}20`,
                color: typeColor,
              }}
            >
              {item.type}
            </span>
            <span style={{ fontSize: "12px", color: "#9ca3af", flexShrink: 0 }}>
              v{item.version}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details dialog"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "#6b7280",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontFamily: "inherit",
              outline: "none",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#9ca3af";
              e.currentTarget.style.color = "#1f2937";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#f3f4f6";
              e.currentTarget.style.color = "#6b7280";
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "20px" }}>
          {item.coverImage && (
            <div
              style={{
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "20px",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <img
                src={item.coverImage}
                alt={item.name}
                style={{ width: "100%", display: "block" }}
              />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            {(item.icon || item.logo) && (
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "rgba(229,231,235,0.45)",
                  backdropFilter: "blur(14px)",
                  flexShrink: 0,
                }}
              >
                <img
                  src={item.icon || item.logo}
                  alt={item.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            )}
            <div>
              <p style={{ fontSize: "14px", color: "#6b7280", lineHeight: "1.6", margin: 0 }}>
                {item.description}
              </p>
            </div>
          </div>

          {item.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(229,231,235,0.45)",
                    backdropFilter: "blur(14px)",
                    borderRadius: "14px",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {item.platforms && item.platforms.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
              {item.platforms.map((p) => (
                <span
                  key={p}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(88, 166, 255, 0.1)",
                    borderRadius: "14px",
                    fontSize: "12px",
                    color: "#6366f1",
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            <button
              onClick={handleInstall}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                background: actionDone ? "#047857" : btn.color,
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                fontFamily: "inherit",
                outline: "none",
                transition: "background 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                if (!actionDone) e.currentTarget.style.background = btn.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = actionDone ? "#047857" : btn.color;
              }}
            >
              {actionDone ? "✓ Copied!" : btn.label}
            </button>

            {item.githubRepo && (
              <button
                onClick={() => window.open(item.githubRepo, "_blank")}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "1px solid rgba(0,0,0,0.1)",
                  color: "#1f2937",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  fontFamily: "inherit",
                  outline: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "border-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#6366f1";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                📂 Source Code
              </button>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            {[
              { label: "Rating", value: `${item.rating.toFixed(1)} ★` },
              { label: "Downloads", value: formatNumber(item.downloads) },
              { label: "Likes", value: formatNumber(item.likeCount) },
              { label: "Version", value: item.version },
              { label: "Size", value: item.fileSize || "N/A" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: "12px",
                  background: "rgba(255,255,255,0.55)",
                  backdropFilter: "blur(24px)",
                  borderRadius: "8px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: "600", color: "#f0f6fc" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "24px", alignItems: "center" }}>
            <LikeButton itemId={item.id} initialLikeCount={item.likeCount} />
            <ShareButton
              itemId={item.id}
              itemName={item.name}
              itemUrl={item.liveDemo || item.githubRepo}
            />
          </div>

          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "20px" }}>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "#f0f6fc",
                marginBottom: "16px",
              }}
            >
              Comments ({item.commentCount})
            </h3>
            <CommentSection
              itemId={item.id}
              comments={comments}
              onCommentAdded={(c) => setComments((prev) => [c, ...prev])}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
