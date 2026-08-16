import { useEffect, useState } from "react";
import { Github, LogOut, Loader2, CheckCircle2 } from "lucide-react";
import { GITHUB_CLIENT_ID, clearAuthState, getAuthState, setAuthState } from "../../lib/ecosystem-auth";
import type { User } from "../../lib/ecosystem-types";

// Production OAuth callback. GitHub requires the redirect_uri used during
// authorization to match the registered callback exactly.
const CALLBACK_URL = "https://zyraxonai.lovable.app/api/public/auth/github/callback";
const OAUTH_SCOPE = "repo user:email";
const STATE_KEY = "zyraxon_github_oauth_state";

function makeState() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export function GitHubHomeAuth() {
  const [auth, setAuth] = useState(getAuthState());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const oauthError = params.get("github_error");

    if (oauthError) {
      setMessage(`GitHub authorization failed: ${oauthError}`);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      return;
    }
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
      setMessage("Connecting to GitHub…");
      try {
        const response = await fetch("/api/public/auth/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.token || !body.user) {
          throw new Error(body?.error?.message || body?.error || "GitHub sign-in failed");
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
          setMessage("");
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
    url.searchParams.set("redirect_uri", CALLBACK_URL);
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

  return <div className="zyraxon-home-auth">
    <style>{`.zyraxon-home-auth{position:absolute;top:12px;right:16px;height:38px;display:flex;align-items:center;z-index:80}.zyraxon-home-auth button{font:inherit}.zha-icon{width:38px;height:38px;padding:0;display:grid;place-items:center;border-radius:12px;color:#f5f5f7;background:rgba(10,10,14,.62);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(28px) saturate(150%);-webkit-backdrop-filter:blur(28px) saturate(150%);box-shadow:0 12px 32px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.08);cursor:pointer;transition:transform .18s ease,background .18s ease}.zha-icon:hover{transform:translateY(-1px);background:rgba(255,255,255,.09)}.zha-avatar{width:30px;height:30px;border-radius:9px;object-fit:cover}.zha-menu{position:absolute;right:0;top:46px;width:250px;padding:14px;border-radius:18px;background:rgba(10,10,16,.94);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(30px) saturate(160%);box-shadow:0 25px 70px rgba(0,0,0,.55)}.zha-message{position:absolute;right:0;top:46px;max-width:320px;padding:10px 12px;border-radius:12px;color:#ededf2;background:rgba(10,10,16,.94);border:1px solid rgba(255,255,255,.1);font-size:12px;line-height:1.45;box-shadow:0 18px 45px rgba(0,0,0,.4)}`}</style>
    {!auth.isAuthenticated || !auth.user ? <>
      <button type="button" className="zha-icon" onClick={startLogin} disabled={busy} aria-label="Sign in with GitHub" title={busy ? "Connecting…" : "Sign in with GitHub"}>
        {busy ? <Loader2 size={18} className="animate-spin"/> : <Github size={20}/>} 
      </button>
      {message && <div className="zha-message">{message}</div>}
    </> : <>
      <button type="button" className="zha-icon" onClick={() => setOpen(v => !v)} aria-label="GitHub profile" title={auth.user.displayName}>
        <img src={auth.user.avatarUrl || ""} alt="" className="zha-avatar"/>
      </button>
      {open && <div className="zha-menu">
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:13}}>
          <img src={auth.user.avatarUrl || ""} alt="" className="zha-avatar"/>
          <div><div style={{color:"#fff",fontWeight:750,fontSize:13}}>{auth.user.displayName}</div><div style={{color:"#9898a8",fontSize:11}}>@{auth.user.username}</div></div>
          <CheckCircle2 size={15} style={{color:"#4ade80",marginLeft:"auto"}}/>
        </div>
        <div style={{color:"#8f8f9d",fontSize:11,marginBottom:12}}>GitHub connected. Repository actions are handled securely by ZYRAXON's server.</div>
        <button type="button" onClick={logout} style={{width:"100%",display:"flex",justifyContent:"center",alignItems:"center",gap:7,borderRadius:11,padding:"9px 12px",color:"#ffb4b4",background:"rgba(255,70,70,.07)",border:"1px solid rgba(255,90,90,.14)",cursor:"pointer"}}><LogOut size={14}/> Sign out</button>
      </div>}
    </>}
  </div>;
}
