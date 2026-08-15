# ZYRAXON AI GitHub connection backend

The website now has a server-side GitHub OAuth bridge. Users authorize GitHub in the browser; the OAuth code is exchanged on the server and the resulting GitHub credential is encrypted before it is stored.

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

All connected-account endpoints require the ZYRAXON Supabase bearer session. GitHub credentials are never sent to the browser by these new endpoints.

## OAuth redirect

The OAuth App's redirect URI must point to the existing browser callback surface used by the Builder/Ecosystem login flow. The backend exchange endpoint itself is a POST endpoint and is intentionally not used as a GitHub redirect URI.
