import { createFileRoute } from '@tanstack/react-router';

/**
 * GitHub OAuth callback landing page.
 *
 * The callback must be the exact URL registered in GitHub. We deliberately do
 * not redirect the temporary OAuth code to the application root. Instead this
 * tiny callback page validates the browser's state value, exchanges the
 * single-use code through our server endpoint, stores the returned app session
 * in the existing client auth store, and then navigates to the clean home URL.
 */
export const Route = createFileRoute('/api/public/auth/github/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code') ?? '';
        const state = url.searchParams.get('state') ?? '';
        const error = url.searchParams.get('error') ?? '';
        const errorDescription = url.searchParams.get('error_description') ?? '';

        const payload = JSON.stringify({ code, state, error, errorDescription });
        const escaped = payload
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u003e')
          .replace(/&/g, '\\u0026');

        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connecting GitHub · ZYRAXON</title>
<style>
html,body{margin:0;min-height:100%;background:#070707;color:#f5f5f7;font-family:Inter,system-ui,sans-serif}
body{display:grid;place-items:center}.card{width:min(420px,calc(100% - 40px));padding:28px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:rgba(20,20,22,.78);backdrop-filter:blur(28px);box-shadow:0 30px 90px rgba(0,0,0,.5)}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#fff;box-shadow:0 0 18px rgba(255,255,255,.7);margin-right:9px}.muted{color:#9a9aa3;font-size:13px;line-height:1.6}
</style></head><body><main class="card"><div><span class="dot"></span><b id="title">Connecting GitHub…</b></div><p id="message" class="muted">Finishing secure sign-in. This window will return to ZYRAXON automatically.</p></main>
<script>
const DATA=${escaped};
const STATE_KEY='zyraxon_github_oauth_state';
const clean=()=>window.location.replace('/');
const setMessage=(title,message)=>{document.getElementById('title').textContent=title;document.getElementById('message').textContent=message};
(async()=>{
  try{
    if(DATA.error){setMessage('GitHub sign-in failed',DATA.errorDescription||DATA.error);setTimeout(clean,1800);return;}
    if(!DATA.code){setMessage('GitHub sign-in failed','No authorization code was returned.');setTimeout(clean,1800);return;}
    const expected=sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if(!expected||!DATA.state||expected!==DATA.state){setMessage('GitHub sign-in could not be verified','The authorization state did not match. Please start GitHub sign-in again.');setTimeout(clean,2200);return;}
    const response=await fetch('/api/public/auth/github',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:DATA.code})});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body.token||!body.user)throw new Error(body?.error?.message||body?.error||'GitHub sign-in failed');
    const u=body.user;
    const user={id:u.id,githubUserId:Number(u.github_id??0),username:u.login,displayName:u.name||u.login,email:u.email||'',avatarUrl:u.avatar_url||'',bio:'',title:'',skills:[],location:'',company:'',blog:'',followerCount:0,followingCount:0,publishedCount:0,createdAt:new Date().toISOString()};
    localStorage.setItem('zyraxon_ecosystem_auth',JSON.stringify({user,token:body.token}));
    setMessage('GitHub connected','Returning to ZYRAXON…');
    setTimeout(clean,250);
  }catch(error){setMessage('GitHub sign-in failed',error instanceof Error?error.message:'Could not complete GitHub sign-in.');setTimeout(clean,2200)}
})();
</script></body></html>`;

        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            Pragma: 'no-cache',
          },
        });
      },
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
