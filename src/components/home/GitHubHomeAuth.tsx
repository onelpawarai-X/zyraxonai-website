import { useEffect, useMemo, useState } from "react";
import { Github, LogOut, UserCircle2, Loader2, CheckCircle2 } from "lucide-react";
import { GITHUB_CLIENT_ID, clearAuthState, getAuthState, setAuthState } from "../../lib/ecosystem-auth";
import type { User } from "../../lib/ecosystem-types";

const CALLBACK_PATH = "/api/public/auth/github/callback";
const OAUTH_SCOPE = "repo user:email";
const STATE_KEY = "zyraxon_github_oauth_state";

function makeState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function GitHubHomeAuth() {
  const [auth, setAuth] = useState(getAuthState());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  const callbackUrl = useMemo(() => `${window.location.origin}${CALLBACK_PATH}`, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    if (!code) return;

    const expectedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);

    if (!returnedState || !expectedState || returnedState !== expectedState) {
      setMessage("GitHub sign-in could not be verified. Please try again.");
      return;
    }

    let cancelled = false;
    (async () => {
      setBusy(true);
      setMessage("Connecting your GitHub account…");
      try {
        const response = await fetch("/api/public/auth/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = await response.json();
        if (!response.ok || !body.token || !body.user) {
          throw new Error(body?.error?.message || "GitHub sign-in failed");
        }

        const apiUser = body.user;
        const user: User = {
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

        if (!cancelled) {
          setAuthState({ user, token: body.token });
          setAuth({ user, token: body.token, isAuthenticated: true });
          setMessage("GitHub connected successfully.");
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "GitHub sign-in failed");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const startLogin = () => {
    const state = makeState();
    sessionStorage.setItem(STATE_KEY, state);
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("scope", OAUTH_SCOPE);
    url.searchParams.set("state", state);
    window.location.assign(url.toString());
  };

  const logout = () => {
    clearAuthState();
    setAuth(getAuthState());
    setOpen(false);
    setMessage("");
  };

  if (!auth.isAuthenticated || !auth.user) {
    return (
      <div style={{ position: "fixed", top: 18, right: 22, zIndex: 2000 }}>
        <button
          type="button"
          onClick={startLogin}
          disabled={busy}
          style={{
            display: "inline-flex", alignItems: "center", gap: 9, borderRadius: 14,
            padding: "11px 16px", color: "#fff", background: "rgba(10,10,16,.72)",
            border: "1px solid rgba(255,255,255,.14)", backdropFilter: "blur(22px) saturate(150%)",
            boxShadow: "0 14px 45px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08)",
            cursor: busy ? "wait" : "pointer", fontWeight: 700, fontSize: 13,
          }}
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Github size={17} />}
          {busy ? "Connecting…" : "Sign in with GitHub"}
        </button>
        {message && (
          <div style={{ marginTop: 10, maxWidth: 290, padding: "10px 12px", borderRadius: 12, color: "#e7e7ee", background: "rgba(10,10,16,.78)", border: "1px solid rgba(255,255,255,.1)", backdropFilter: "blur(18px)", fontSize: 12 }}>
            {message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", top: 16, right: 18, zIndex: 2000 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "7px 11px 7px 7px",
          borderRadius: 16, color: "#fff", background: "rgba(8,8,14,.72)",
          border: "1px solid rgba(255,255,255,.14)", backdropFilter: "blur(24px) saturate(160%)",
          boxShadow: "0 16px 50px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.08)", cursor: "pointer",
        }}
      >
        <img src={auth.user.avatarUrl || ""} alt="" style={{ width: 31, height: 31, borderRadius: 10, objectFit: "cover", background: "rgba(255,255,255,.08)" }} />
        <span style={{ fontWeight: 700, fontSize: 13, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.user.displayName}</span>
        <CheckCircle2 size={15} style={{ color: "#4ade80" }} />
      </button>

      {open && (
        <div style={{ marginTop: 9, width: 250, padding: 14, borderRadius: 18, background: "rgba(9,9,15,.82)", border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(28px) saturate(160%)", boxShadow: "0 25px 70px rgba(0,0,0,.48)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 13 }}>
            <UserCircle2 size={18} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#fff", fontWeight: 750, fontSize: 13 }}>{auth.user.displayName}</div>
              <div style={{ color: "#9898a8", fontSize: 11 }}>@{auth.user.username}</div>
            </div>
          </div>
          <div style={{ color: "#8f8f9d", fontSize: 11, marginBottom: 12 }}>GitHub is connected to ZYRAXON AI. Repository actions are handled by the server.</div>
          <button type="button" onClick={logout} style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 7, borderRadius: 11, padding: "9px 12px", color: "#ffb4b4", background: "rgba(255,70,70,.07)", border: "1px solid rgba(255,90,90,.14)", cursor: "pointer" }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
