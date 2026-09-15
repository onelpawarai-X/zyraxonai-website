import { useEffect, useState } from "react";
import { Github, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { clearAuthState, getAuthState, setAuthState } from "../../lib/ecosystem-auth";
import type { User } from "../../lib/ecosystem-types";

function toUser(apiUser: any): User {
  return {
    id: apiUser.id,
    githubUserId: Number(apiUser.github_id ?? 0),
    username: apiUser.login,
    displayName: apiUser.name || apiUser.login,
    email: apiUser.email || "",
    avatarUrl: apiUser.avatar_url || "",
    bio: "",
    title: "",
    skills: [],
    location: "",
    company: "",
    blog: "",
    followerCount: 0,
    followingCount: 0,
    publishedCount: 0,
    createdAt: new Date().toISOString(),
  };
}

export function GitHubHomeAuth() {
  const [auth, setAuth] = useState(getAuthState());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("github") === "connected";
    const error = params.get("github_error");
    if (connected || error)
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.hash,
      );

    if (error) {
      setMessage(`GitHub sign-in failed: ${error}`);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/public/auth/github/me", { credentials: "include" });
        if (!response.ok) return;
        const body = await response.json();
        if (body?.user && !cancelled) {
          const user = toUser(body.user);
          setAuthState({ user, token: null });
          setAuth({ user, token: null, isAuthenticated: true });
        }
      } catch {
        /* ignored */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startLogin = () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    window.location.assign("/api/public/auth/github/start?return_to=%2F");
  };

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/public/auth/github/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignored */
    }
    clearAuthState();
    setAuth({ user: null, token: null, isAuthenticated: false });
    setOpen(false);
    setBusy(false);
    setMessage("");
  };

  return (
    <div className="zyraxon-home-auth">
      <style>{`.zyraxon-home-auth{position:absolute;top:12px;right:16px;height:38px;display:flex;align-items:center;z-index:40}.zha-icon{width:38px;height:38px;padding:0;display:grid;place-items:center;border-radius:12px;color:#f5f5f7;background:rgba(10,10,14,.62);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(28px) saturate(150%);-webkit-backdrop-filter:blur(28px) saturate(150%);box-shadow:0 12px 32px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.08);cursor:pointer}.zha-icon:disabled{opacity:.62;cursor:wait}.zha-avatar{width:30px;height:30px;border-radius:9px;object-fit:cover}.zha-menu{position:absolute;right:0;top:46px;width:250px;padding:14px;border-radius:18px;background:rgba(10,10,16,.94);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(30px) saturate(160%);box-shadow:0 25px 70px rgba(0,0,0,.55)}.zha-message{position:absolute;right:0;top:46px;max-width:320px;padding:10px 12px;border-radius:12px;color:#ededf2;background:rgba(10,10,16,.94);border:1px solid rgba(255,255,255,.1);font-size:12px;line-height:1.45}`}</style>
      {!auth.isAuthenticated || !auth.user ? (
        <>
          <button
            type="button"
            className="zha-icon"
            onClick={startLogin}
            disabled={busy}
            aria-label="Sign in with GitHub"
            title="Sign in with GitHub"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Github size={20} />}
          </button>
          {message && <div className="zha-message">{message}</div>}
        </>
      ) : (
        <>
          <button
            type="button"
            className="zha-icon"
            onClick={() => setOpen((v) => !v)}
            aria-label="GitHub profile"
            title={auth.user.displayName}
          >
            {auth.user.avatarUrl ? (
              <img src={auth.user.avatarUrl} alt="" className="zha-avatar" />
            ) : (
              <Github size={20} />
            )}
          </button>
          {open && (
            <div className="zha-menu">
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 13 }}>
                <img src={auth.user.avatarUrl || ""} alt="" className="zha-avatar" />
                <div>
                  <div style={{ color: "#fff", fontWeight: 750, fontSize: 13 }}>
                    {auth.user.displayName}
                  </div>
                  <div style={{ color: "#9898a8", fontSize: 11 }}>@{auth.user.username}</div>
                </div>
                <CheckCircle2 size={15} style={{ color: "#4ade80", marginLeft: "auto" }} />
              </div>
              <div style={{ color: "#8f8f9d", fontSize: 11, marginBottom: 12 }}>
                GitHub is connected. Publishing uses the server-side connection.
              </div>
              <button
                type="button"
                onClick={logout}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 7,
                  borderRadius: 11,
                  padding: "9px 12px",
                  color: "#ffb4b4",
                  background: "rgba(255,70,70,.07)",
                  border: "1px solid rgba(255,90,90,.14)",
                  cursor: "pointer",
                }}
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
