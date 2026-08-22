import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/auth/github/logout")({
  server: {
    handlers: {
      POST: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Cache-Control": "no-store",
            "Set-Cookie":
              "zyraxon_github_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
          },
        }),
      OPTIONS: async () => new Response(null, { status: 204 }),
    },
  },
});
