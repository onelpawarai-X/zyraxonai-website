import { createFileRoute } from "@tanstack/react-router";
import { buildContext } from "@/lib/api/context.server";
import { githubExchange } from "@/lib/api/auth.server";

export const Route = createFileRoute("/api/public/auth/github")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204 }),
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const ctx = await buildContext(request, url, {});
          const result = await githubExchange(ctx);
          return Response.json(result, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          const status =
            error && typeof error === "object" && "status" in error
              ? Number((error as { status?: number }).status)
              : 500;
          const message = error instanceof Error ? error.message : "GitHub authentication failed";
          return Response.json(
            { error: { message } },
            { status: Number.isFinite(status) ? status : 500 },
          );
        }
      },
    },
  },
});
