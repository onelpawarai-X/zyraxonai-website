import React, { useEffect, useRef, useState } from "react";
import {
  getRecord,
  install,
  isInstalled,
  isAppDetected,
  detectApp,
  setAppDetected,
  setEnabled,
  subscribe,
  uninstall,
  type InstalledRecord,
  type InstallTarget,
} from "@/lib/marketplace-install";

/**
 * ZYRAXON Agent install control.
 * - If app detected → install directly via deep link
 * - If app NOT detected → show "Install ZYRAXON Agent" modal
 * - Local state mirror for instant UI
 */
export const InstallButton: React.FC<{ target: InstallTarget; size?: "sm" | "md" }> = ({
  target,
  size = "sm",
}) => {
  const [record, setRecord] = useState<InstalledRecord | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecord(getRecord(target.id));
    return subscribe((all) => setRecord(all[target.id]));
  }, [target.id]);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menu]);

  const handleInstall = async () => {
    setBusy(true);
    setDetecting(true);
    try {
      const detected = isAppDetected();
      if (detected === true) {
        await install(target);
      } else {
        const result = await detectApp();
        if (result) {
          setAppDetected(true);
          await install(target);
        } else {
          setAppDetected(false);
          setShowAppModal(true);
          setBusy(false);
          setDetecting(false);
          return;
        }
      }
    } finally {
      setBusy(false);
      setDetecting(false);
    }
  };

  const pad = size === "md" ? "8px 18px" : "5px 12px";
  const font = size === "md" ? 13 : 12;

  const base: React.CSSProperties = {
    padding: pad,
    fontSize: font,
    fontWeight: 600,
    borderRadius: 8,
    cursor: busy ? "wait" : "pointer",
    fontFamily: "inherit",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  };

  const menuItem: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 12px",
    background: "none",
    border: "none",
    color: "#1f2937",
    fontSize: 12.5,
    cursor: "pointer",
    fontFamily: "inherit",
    borderRadius: 6,
  };

  return (
    <>
      <div
        ref={wrap}
        style={{ position: "relative", display: "inline-flex", gap: 4 }}
      >
        {!record ? (
          <button
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); handleInstall(); }}
            style={{
              ...base,
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff",
              boxShadow: "0 3px 14px rgba(99,102,241,0.35)",
            }}
          >
            {detecting ? "Detecting app..." : busy ? "Installing..." : "Install"}
          </button>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setMenu((m) => !m); }}
              style={{
                ...base,
                background: "rgba(63,185,80,0.12)",
                border: "1px solid rgba(63,185,80,0.45)",
                color: record.enabled ? "#10b981" : "#6b7280",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
              </svg>
              {record.enabled ? "Installed" : "Disabled"}
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 6l4 4 4-4z" />
              </svg>
            </button>
            {menu && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  right: 0,
                  minWidth: 180,
                  zIndex: 70,
                  padding: 5,
                  background: "rgba(249,250,251,0.98)",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 10,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.05)",
                }}
              >
                <button
                  style={menuItem}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  onClick={() => {
                    setMenu(false);
                    void (async () => {
                      setBusy(true);
                      try { await setEnabled(target.id, !record.enabled); } finally { setBusy(false); }
                    })();
                  }}
                >
                  {record.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  style={menuItem}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  onClick={() => {
                    setMenu(false);
                    handleInstall();
                  }}
                >
                  Reinstall / Update
                </button>
                <button
                  style={{ ...menuItem, color: "#ef4444" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  onClick={() => {
                    setMenu(false);
                    void (async () => {
                      setBusy(true);
                      try { await uninstall(target.id); } finally { setBusy(false); }
                    })();
                  }}
                >
                  Uninstall
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ZYRAXON Agent not installed modal */}
      {showAppModal && (
        <div
          onClick={() => setShowAppModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 16, maxWidth: 480, width: "100%",
              overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0 }}>ZYRAXON Agent Required</h3>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Install the app to manage extensions</p>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "0 0 16px" }}>
                To install <strong>{target.displayName}</strong>, you need <strong>ZYRAXON Agent</strong> — the AI-powered desktop agent with a built-in extension marketplace.
              </p>

              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "0 0 10px" }}>Quick setup:</p>
                <ol style={{ fontSize: 13, color: "#6b7280", margin: 0, paddingLeft: 18, lineHeight: 2 }}>
                  <li>Download ZYRAXON Agent from GitHub</li>
                  <li>Install and open the application</li>
                  <li>Come back and click <strong>Install</strong> again</li>
                  <li>The extension will install automatically</li>
                </ol>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  href="https://github.com/onelpawarai-X/ZYRAXON-AI/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                    borderRadius: 10, background: "#111827", color: "white", textDecoration: "none",
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
                  Download from GitHub
                </a>
                <a
                  href="/download/zyraxon-agent"
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                    borderRadius: 10, border: "1px solid #e5e7eb", background: "white", color: "#374151",
                    textDecoration: "none", fontSize: 14, fontWeight: 600,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  Download from Website
                </a>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowAppModal(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { isInstalled };
export default InstallButton;
