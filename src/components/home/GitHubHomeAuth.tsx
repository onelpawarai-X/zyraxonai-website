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
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.token || !body.user) throw new Error(body?.error?.message || body?.error || "GitHub sign-in failed");
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
    return () => { cancelled = true; };
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

  return (
    <div className="zyraxon-home-auth">
      <style>{`.zyraxon-home-auth{height:58px;display:flex;justify-content:flex-end;align-items:center;padding:0 18px;box-sizing:border-box;background:rgba(7,7,12,.86);border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(26px) saturate(160%);position:relative;z-index:30}.zyraxon-home-auth button{font:inherit}.zha-trigger{display:flex;align-items:center;gap:9px;padding:7px 11px 7px 7px;border-radius:15px;color:#fff;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 35px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.07);cursor:pointer}.zha-avatar{width:30px;height:30px;border-radius:10px;object-fit:cover;background:rgba(255,255,255,.08)}.zha-menu{position:absolute;right:18px;top:51px;width:250px;padding:14px;border-radius:18px;background:rgba(10,10,16,.94);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(28px) saturate(160%);box-shadow:0 25px 70px rgba(0,0,0,.5)}.zha-signin{display:inline-flex;align-items:center;gap:9px;border-radius:13px;padding:10px 15px;color:#fff;background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.12);cursor:pointer;font-weight:700}.zha-message{position:absolute;right:18px;top:51px;margin-top:7px;max-width:290px;padding:10px 12px;border-radius:12px;color:#e7e7ee;background:rgba(10,10,16,.94);border:1px solid rgba(255,255,255,.1);font-size:12px;box-shadow:0 18px 45px rgba(0,0,0,.4)}`}</style>
      {!auth.isAuthenticated || !auth.user ? (
        <>
          <button type="button" className="zha-signin" onClick={startLogin} disabled={busy}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Github size={17} />}
            {busy ? "Connecting…" : "Sign in with GitHub"}
          </button>
          {message && <div className="zha-message">{message}</div>}
        </>
      ) : (
        <>
          <button type="button" className="zha-trigger" onClick={() => setOpen((v) => !v)}>
            <img src={auth.user.avatarUrl || ""} alt="" className="zha-avatar" />
            <span style={{ fontWeight: 700, fontSize: 13, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.user.displayName}</span>
            <CheckCircle2 size={15} style={{ color: "#4ade80" }} />
          </button>
          {open && <div className="zha-menu">
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 13 }}><UserCircle2 size={18} /><div><div style={{ color: "#fff", fontWeight: 750, fontSize: 13 }}>{auth.user.displayName}</div><div style={{ color: "#9898a8", fontSize: 11 }}>@{auth.user.username}</div></div></div>
            <div style={{ color: "#8f8f9d", fontSize: 11, marginBottom: 12 }}>GitHub is connected to ZYRAXON AI. Repository actions are handled by the server.</div>
            <button type="button" onClick={logout} style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 7, borderRadius: 11, padding: "9px 12px", color: "#ffb4b4", background: "rgba(255,70,70,.07)", border: "1px solid rgba(255,90,90,.14)", cursor: "pointer" }}><LogOut size={14} /> Sign out</button>
          </div>}
        </>
      )}
    </div>
  );
}
