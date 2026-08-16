# ZYRAXON AI GitHub connection backend

The website uses a server-side GitHub OAuth bridge. Users authorize GitHub in the browser; the one-time OAuth code is returned to the rendered ZYRAXON homepage, exchanged through the server, and the resulting GitHub credential is encrypted before it is stored.

## Required server environment

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY` — base64 encoding of exactly 32 random bytes
- Existing Supabase backend environment (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the existing service-role configuration)

Do not commit any of these values. Do not place the GitHub client secret or encryption key in browser code.

## API surface

- `POST /api/public/auth/github` — exchange an OAuth authorization code for a ZYRAXON session and persist the encrypted GitHub connection.
- `GET /api/github/repos` — list repositories for the authenticated connected GitHub account.
- `POST /api/github/repos` — create a repository owned by the connected GitHub account.
- `POST /api/github/repos/:owner/:repo/publish` — publish a generated project as one Git commit using GitHub's Git data APIs.

All connected-account endpoints require the ZYRAXON Supabase bearer session. GitHub credentials are never sent to the browser by these endpoints.

## OAuth App values

- Homepage URL: `https://zyraxonai.lovable.app/`
- Redirect URI: `https://zyraxonai.lovable.app/`
- Scope: `repo user:email`

The homepage is the browser callback surface because `GitHubHomeAuth` is mounted there. After GitHub redirects back, the app validates `state`, exchanges the one-time code server-side, removes `code`/`state` from the address bar, and renders the normal profile icon. The backend `/api/public/auth/github/callback` remains only as a compatibility bridge for an older registered callback and immediately redirects to the homepage.
