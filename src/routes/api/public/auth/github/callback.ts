import { createFileRoute } from '@tanstack/react-router';

const STATE_COOKIE = 'zyraxon_github_oauth_state';

function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? '';
  const entry = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

export const Route = createFileRoute('/api/public/auth/github/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code') ?? '';
        const state = url.searchParams.get('state') ?? '';
        const error = url.searchParams.get('error') ?? '';
        const errorDescription = url.searchParams.get('error_description') ?? '';
        const expectedState = readCookie(request, STATE_COOKIE);

        const payload = JSON.stringify({ code, state, error, errorDescription, stateValid: Boolean(state && expectedState && state === expectedState) });
        const escaped = payload.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GitHub · ZYRAXON</title><style>html,body{margin:0;min-height:100%;background:#050505;color:#f5f5f7;font-family:Inter,system-ui,sans-serif}body{display:grid;place-items:center}.card{width:min(430px,calc(100% - 40px));padding:28px;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:rgba(18,18,18,.78);backdrop-filter:blur(30px);box-shadow:0 30px 90px rgba(0,0,0,.55)}.muted{color:#a1a1aa;font-size:13px;line-height:1.6}.dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#fff;box-shadow:0 0 18px rgba(255,255,255,.75);margin-right:9px}</style></head><body><main class="card"><div><span class="dot"></span><b id="title">Connecting GitHub…</b></div><p id="message" class="muted">Completing secure sign-in…</p></main><script>const DATA=${escaped};const clean=()=>window.location.replace('/builder');const setMessage=(t,m)=>{document.getElementById('title').textContent=t;document.getElementById('message').textContent=m};(async()=>{try{if(DATA.error){setMessage('GitHub sign-in failed',DATA.errorDescription||DATA.error);setTimeout(clean,1800);return}if(!DATA.code){setMessage('GitHub sign-in failed','No authorization code was returned.');setTimeout(clean,1800);return}if(!DATA.stateValid){setMessage('GitHub sign-in could not be verified','The OAuth state did not match. Please start GitHub sign-in again.');setTimeout(clean,2200);return}const r=await fetch('/api/public/auth/github',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:DATA.code})});const body=await r.json().catch(()=>({}));if(!r.ok||!body.token||!body.user)throw new Error(body?.error?.message||body?.error||'GitHub sign-in failed');const u=body.user;const user={id:u.id,githubUserId:Number(u.github_id??0),username:u.login,displayName:u.name||u.login,email:u.email||'',avatarUrl:u.avatar_url||'',bio:'',title:'',skills:[],location:'',company:'',blog:'',followerCount:0,followingCount:0,publishedCount:0,createdAt:new Date().toISOString()};localStorage.setItem('zyraxon_ecosystem_auth',JSON.stringify({user,token:body.token}));setMessage('GitHub connected','Returning to ZYRAXON…');setTimeout(clean,250)}catch(e){setMessage('GitHub sign-in failed',e instanceof Error?e.message:'Could not complete GitHub sign-in.');setTimeout(clean,2200)}})();</script></body></html>`;

        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
            'Set-Cookie': `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
