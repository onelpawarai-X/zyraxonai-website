import React, { useState } from "react";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const IconHome = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const IconGlobe = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>;
const IconPackage = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
const IconDownload = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
const IconUpload = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>;
const IconStar = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;

const mainNav: NavItem[] = [
  { id: "home", label: "Home", icon: IconHome },
  { id: "published", label: "Published Apps", icon: IconGlobe },
  { id: "featured", label: "Featured", icon: IconStar },
  { id: "extensions", label: "Extensions", icon: IconPackage },
  { id: "releases", label: "Releases", icon: IconDownload },
  { id: "publish", label: "Publish", icon: IconUpload },
];

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const [collapsed, setCollapsed] = useState(false);

  const navBtn = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 12, width: "100%",
    padding: collapsed ? "10px" : "10px 12px",
    justifyContent: collapsed ? "center" : "flex-start",
    background: active ? "#ecfdf5" : "transparent",
    border: "none", borderRadius: 8,
    color: active ? "#059669" : "#6b7280",
    cursor: "pointer", fontSize: 14, fontWeight: active ? 600 : 400,
    fontFamily: "inherit", transition: "all 0.15s", outline: "none",
  });

  return (
    <div style={{
      width: collapsed ? 56 : 220, minWidth: collapsed ? 56 : 220,
      height: "100vh", background: "white", borderRight: "1px solid #e5e7eb",
      display: "flex", flexDirection: "column", transition: "width 0.2s",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? "16px 8px" : "16px", borderBottom: "1px solid #e5e7eb" }}>
        {!collapsed && <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Ecosystem</span>}
        <button onClick={() => setCollapsed(!collapsed)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "none", border: "1px solid #e5e7eb", borderRadius: 6, color: "#6b7280", cursor: "pointer", flexShrink: 0 }}>
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {!collapsed && <div style={{ padding: "8px 12px 4px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>Browse</div>}
        {mainNav.map((item) => (
          <button key={item.id} onClick={() => onViewChange(item.id)}
            style={navBtn(currentView === item.id)} title={collapsed ? item.label : undefined}>
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: collapsed ? 8 : "12px", borderTop: "1px solid #e5e7eb" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, color: "#6b7280", textDecoration: "none", fontSize: 13, justifyContent: collapsed ? "center" : "flex-start" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
          {!collapsed && <span>Back to Home</span>}
        </a>
      </div>
    </div>
  );
};
