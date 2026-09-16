import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getAllItems,
  getCategories,
  getStats,
  getRecentActivity,
  getAuthState,
  clearAuthState,
  initGitHubStorage,
  clearGitHubStorage,
  loginWithToken,
  type EcosystemItem,
  type CategoryInfo,
  type EcosystemStats,
  type RecentActivity,
  type User,
  type ViewMode,
} from "../../lib/ecosystem";
import { Sidebar } from "../../components/ecosystem/Sidebar";
import { SearchBar } from "../../components/ecosystem/SearchBar";
import { StatsCard } from "../../components/ecosystem/StatsCard";
import { CategoryCard } from "../../components/ecosystem/CategoryCard";
import { ItemCard } from "../../components/ecosystem/ItemCard";
import { RecentActivity as RecentActivityWidget } from "../../components/ecosystem/RecentActivity";
import { LoginButton } from "../../components/ecosystem/LoginButton";
import { UserProfile } from "../../components/ecosystem/UserProfile";
import { ProductDetail } from "../../components/ecosystem/ProductDetail";
import { DetailModal } from "../../components/ecosystem/DetailModal";
import { Marketplace } from "../../components/ecosystem/Marketplace";
import { ZyraxonMarketplace } from "../../components/ecosystem/ZyraxonMarketplace";
import GitHubReleases from "../../components/ecosystem/GitHubReleases";
import { PublishModal } from "../../components/ecosystem/PublishModal";
import { PublishedApps } from "../../components/ecosystem/PublishedApps";
import { MCPToolsPage } from "../../components/ecosystem/MCPToolsPage";

export const Route = createFileRoute("/ecosystem/")({
  head: () => ({
    meta: [
      { title: "ZYRAXON Ecosystem — AI Marketplace" },
      {
        name: "description",
        content: "Explore plugins, AI bots, templates, and tools for the ZYRAXON ecosystem.",
      },
      { property: "og:title", content: "ZYRAXON Ecosystem — AI Marketplace" },
      {
        property: "og:description",
        content: "Explore plugins, AI bots, templates, and tools for the ZYRAXON ecosystem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EcosystemPage,
});

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: 16,
};
const emptyStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "60px 0",
  color: "#6b7280",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: "#1f2937",
  marginBottom: 16,
};

export default function EcosystemPage() {
  const [view, setView] = useState<ViewMode>("home");
  const [items, setItems] = useState<EcosystemItem[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [stats, setStats] = useState<EcosystemStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<EcosystemItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [authState, setAuthState] = useState(getAuthState());
  const [pendingItem, setPendingItem] = useState<string | null>(null);
  const [vsCodeDeepLink, setVsCodeDeepLink] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allItems, cats, st, recent] = await Promise.all([
        getAllItems(),
        getCategories(),
        getStats(),
        getRecentActivity(),
      ]);
      setItems(allItems);
      setCategories(cats);
      setStats(st);
      setActivities(recent);
    } catch (err) {
      console.error("Failed to load ecosystem data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const auth = getAuthState();
    setAuthState(auth);
    if (auth.isAuthenticated && auth.token && auth.user)
      initGitHubStorage(auth.token, auth.user.username);
    const params = new URLSearchParams(window.location.search);
    if (params.get("code") && params.get("state")) {
      window.history.replaceState({}, "", "/ecosystem");
    }
  }, [loadData]);

  // Capture ?item= deep-link on mount (runs once).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemParam = params.get("item");
    if (itemParam) {
      setPendingItem(itemParam);
    }
  }, []);

  // After data finishes loading, resolve the deep-link.
  // Ecosystem items  → product-detail view
  // VS Code extension IDs (contain a dot) → Extensions view
  // Anything else    → search / explore
  useEffect(() => {
    if (!pendingItem || loading) return;

    const q = pendingItem.toLowerCase();

    const found = items.find(
      (i) =>
        i.id.toLowerCase() === q ||
        i.name.toLowerCase() === q ||
        i.name.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase() === q),
    );

    if (found) {
      setSelectedItem(found);
      setView("product-detail");
    } else if (pendingItem.includes(".")) {
      // Looks like a VS Code extension ID (e.g. ms-python.python)
      setVsCodeDeepLink(pendingItem);
      setView("vscode");
    } else {
      setSearchQuery(pendingItem);
      setView("explore");
    }

    setPendingItem(null);
    // Clean the URL so the user can refresh normally
    window.history.replaceState({}, "", "/ecosystem");
  }, [pendingItem, loading, items]);

  // Reset VS Code deep link when navigating away from Extensions view
  useEffect(() => {
    if (view !== "vscode" && vsCodeDeepLink) {
      setVsCodeDeepLink(null);
    }
  }, [view]);

  const user = authState.user;

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.author.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (activeCategory) result = result.filter((i) => i.category === activeCategory);
    return result;
  }, [items, searchQuery, activeCategory]);

  const sortedItems = useMemo(() => {
    const arr = [...filteredItems];
    if (view === "top-rated") return arr.sort((a, b) => b.rating - a.rating);
    if (view === "trending") return arr.sort((a, b) => b.downloads - a.downloads);
    if (view === "new")
      return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [filteredItems, view]);

  const featuredItems = useMemo(() => items.filter((i) => i.featured).slice(0, 6), [items]);

  const handleLogin = async (token: string) => {
    const u = await loginWithToken(token);
    if (u) {
      setAuthState(getAuthState());
      initGitHubStorage(token, u.username);
    }
  };

  const handleLogout = () => {
    clearAuthState();
    clearGitHubStorage();
    setAuthState(getAuthState());
  };
  const navigateTo = (v: string) => {
    if (v === "builder") {
      window.location.href = "/builder";
      return;
    }
    setView(v as ViewMode);
    setSelectedItem(null);
    setActiveCategory(null);
    setSearchQuery("");
  };
  const openItem = (item: EcosystemItem) => {
    setSelectedItem(item);
    setView("product-detail");
  };
  const handleViewUser = () => {
    setView("profile");
  };

  const renderGrid = (list: EcosystemItem[]) => (
    <div style={gridStyle}>
      {list.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onClick={() => openItem(item)}
          onUserClick={handleViewUser}
        />
      ))}
      {list.length === 0 && <div style={emptyStyle}>No items found.</div>}
    </div>
  );

  const viewTitle =
    (
      {
        "top-rated": "Top Rated",
        trending: "Trending",
        new: "New Arrivals",
        "my-plugins": "My Plugins",
        "my-downloads": "My Downloads",
        "my-favorites": "My Favorites",
        explore: "Explore",
        home: "Home",
        publish: "Publish",
        published: "Published Apps",
      } as Record<string, string>
    )[view] || "Explore";

  return (
    <div
      className="zx-glass-root"
      style={{
        position: "relative",
        display: "flex",
        minHeight: "100vh",
        color: "#1f2937",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div className="zx-aurora" aria-hidden="true" />
      <Sidebar currentView={view} onViewChange={navigateTo} />
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 24px",
            background: "rgba(248,249,252,0.85)",
            backdropFilter: "blur(28px) saturate(160%)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ flex: 1, maxWidth: 560 }}>
            <SearchBar onSearch={setSearchQuery} />
          </div>
          {view === "product-detail" && (
            <button
              onClick={() => {
                setSelectedItem(null);
                setView("home");
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid rgba(0,0,0,0.1)",
                background: "rgba(255,255,255,0.7)",
                backdropFilter: "blur(20px)",
                color: "#374151",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ← Back
            </button>
          )}
          <LoginButton onLogout={handleLogout} onNavigate={navigateTo} />
        </header>
        <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "60vh",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: "3px solid #e5e7eb",
                  borderTopColor: "#6366f1",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ color: "#6b7280", fontSize: 14 }}>Loading ecosystem...</div>
            </div>
          ) : (
            <>
              {/* ── Home ── */}
              <div
                style={{
                  display: view === "home" ? "flex" : "none",
                  flexDirection: "column",
                  gap: 32,
                }}
              >
                <StatsCard stats={stats} />
                <section>
                  <h2 style={sectionTitle}>Categories</h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {categories.map((cat) => (
                      <CategoryCard
                        key={cat.id}
                        category={cat}
                        onClick={() => {
                          setActiveCategory(cat.id);
                          navigateTo("categories");
                        }}
                      />
                    ))}
                  </div>
                </section>
                <section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h2 style={{ ...sectionTitle, marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: "linear-gradient(135deg,#059669,#10b981)", display: "inline-block", boxShadow: "0 0 12px rgba(16,185,129,0.8)" }} />
                      Published Apps
                    </h2>
                    <button onClick={() => navigateTo("published")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px)", color: "#059669", cursor: "pointer", fontSize: 13 }}>
                      Browse all →
                    </button>
                  </div>
                  <PublishedApps compact />
                </section>
                {featuredItems.length > 0 && (
                  <section>
                    <h2 style={sectionTitle}>Featured</h2>
                    {renderGrid(featuredItems)}
                  </section>
                )}
                <section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h2 style={{ ...sectionTitle, marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: "linear-gradient(135deg,#8957e5,#58a6ff)", display: "inline-block", boxShadow: "0 0 12px rgba(137,87,229,0.8)" }} />
                      ZYRAXON AI Extensions
                    </h2>
                    <button onClick={() => navigateTo("vscode")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px)", color: "#6366f1", cursor: "pointer", fontSize: 13 }}>
                      Browse all →
                    </button>
                  </div>
                  <ZyraxonMarketplace />
                </section>
                <section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <h2 style={{ ...sectionTitle, marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: "linear-gradient(135deg,#f0883e,#da3633)", display: "inline-block", boxShadow: "0 0 12px rgba(240,136,62,0.8)" }} />
                      GitHub Releases
                    </h2>
                    <button onClick={() => navigateTo("github")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px)", color: "#6366f1", cursor: "pointer", fontSize: 13 }}>
                      Browse all →
                    </button>
                  </div>
                  <GitHubReleases compact />
                </section>
                <section>
                  <h2 style={sectionTitle}>Recent Activity</h2>
                  <RecentActivityWidget activities={activities} />
                </section>
              </div>
              {/* ── Categories ── */}
              <div
                style={{
                  display: view === "categories" ? "flex" : "none",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    onClick={() => setActiveCategory(null)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: "1px solid",
                      borderColor: !activeCategory ? "#6366f1" : "#e5e7eb",
                      background: !activeCategory ? "rgba(99,102,241,0.1)" : "#fff",
                      color: !activeCategory ? "#6366f1" : "#6b7280",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: "1px solid",
                        borderColor: activeCategory === cat.id ? "#6366f1" : "#e5e7eb",
                        background: activeCategory === cat.id ? "rgba(99,102,241,0.1)" : "#fff",
                        color: activeCategory === cat.id ? "#6366f1" : "#6b7280",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
                {renderGrid(sortedItems)}
              </div>
              {/* ── Marketplace ── */}
              <div style={{ display: view === "marketplace" ? "block" : "none" }}>
                <Marketplace onSelectItem={openItem} onUserClick={handleViewUser} />
              </div>
              {/* ── Extensions (VS Code) ── */}
              <div
                style={{
                  display: view === "vscode" ? "flex" : "none",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <ZyraxonMarketplace deepLinkId={vsCodeDeepLink} />
              </div>
              {/* ── GitHub Releases ── */}
              <div style={{ display: view === "github" ? "block" : "none" }}>
                <GitHubReleases />
              </div>
              {/* ── Published Apps ── */}
              <div style={{ display: view === "published" ? "block" : "none" }}>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: "linear-gradient(135deg,#059669,#10b981)", display: "inline-block", boxShadow: "0 0 12px rgba(16,185,129,0.8)" }} />
                    Published Apps
                  </h2>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Projects published via the ZYRAXON Ecosystem Hub</p>
                </div>
                <PublishedApps />
              </div>
              {/* ── Publish ── */}
              <div style={{ display: view === "publish" ? "block" : "none" }}>
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ ...sectionTitle, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: "linear-gradient(135deg,#059669,#10b981)", display: "inline-block", boxShadow: "0 0 12px rgba(16,185,129,0.8)" }} />
                    Publish Your Project
                  </h2>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
                    Send your project to the ZYRAXON Ecosystem Hub. Auto-scanned, then published live.
                  </p>
                </div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "white", padding: 24, marginBottom: 24 }}>
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1e40af", margin: "0 0 8px" }}>How it works</h3>
                    <ol style={{ fontSize: 13, color: "#1e3a5f", margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                      <li>Click <strong>Publish</strong> and enter your agent API key</li>
                      <li>Fill in project details — name, description, category, etc.</li>
                      <li>The system auto-scans your code for security findings</li>
                      <li>No critical findings = goes live instantly on the marketplace</li>
                      <li>Connect your GitHub to track stats and publish count</li>
                    </ol>
                  </div>
                  <button onClick={() => setShowPublish(true)}
                    style={{ padding: "10px 24px", borderRadius: 8, background: "linear-gradient(135deg, #059669, #10b981)", border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
                    Publish Now
                  </button>
                </div>
              </div>
              {/* ── MCP Tools ── */}
              <div style={{ display: view === "mcp" ? "block" : "none" }}>
                <MCPToolsPage />
              </div>
              {/* ── Profile ── */}
              {user && (
                <div style={{ display: view === "profile" ? "block" : "none" }}>
                  <UserProfile user={user} isOwnProfile />
                </div>
              )}
              {/* ── Generic views (explore, top-rated, trending, new, my-*) ── */}
              {view !== "home" &&
                view !== "categories" &&
                view !== "marketplace" &&
                view !== "vscode" &&
                view !== "github" &&
                view !== "profile" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <h2 style={sectionTitle}>{viewTitle}</h2>
                    {renderGrid(sortedItems)}
                  </div>
                )}
            </>
          )}
        </div>
      </main>
      {view === "product-detail" && selectedItem && (
        <ProductDetail
          item={selectedItem}
          onClose={() => {
            setSelectedItem(null);
            setView("home");
          }}
        />
      )}
      {selectedItem && view !== "product-detail" && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
      <PublishModal
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
        onPublished={() => {
          loadData();
          setShowPublish(false);
        }}
      />
    </div>
  );
}
