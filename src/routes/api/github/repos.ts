import { createFileRoute } from "@tanstack/react-router";
import { buildContext } from "@/lib/api/context.server";
import { badRequest, readJson } from "@/lib/api/http.server";
import { githubRequest, requireGitHubToken } from "@/lib/github-connection.server";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  default_branch: string;
};

export const Route = createFileRoute("/api/github/repos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const ctx = await buildContext(request, new URL(request.url), {});
          const { token } = await requireGitHubToken(ctx);
          const repos = await githubRequest<GitHubRepo[]>(
            "/user/repos?per_page=100&sort=updated",
            token,
          );
          return Response.json({ repositories: repos });
        } catch (error) {
          const status =
            error && typeof error === "object" && "status" in error
              ? Number((error as { status?: number }).status)
              : 500;
          return Response.json(
            {
              error: { message: error instanceof Error ? error.message : "GitHub request failed" },
            },
            { status },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const ctx = await buildContext(request, new URL(request.url), {});
          const { token } = await requireGitHubToken(ctx);
          const body = await readJson<{
            name?: string;
            description?: string;
            private?: boolean;
            auto_init?: boolean;
          }>(request);
          const name = body.name?.trim();
          if (!name || !/^[A-Za-z0-9._-]{1,100}$/.test(name))
            throw badRequest("A valid repository name is required");

          const repo = await githubRequest<GitHubRepo>("/user/repos", token, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              description: body.description?.trim() || undefined,
              private: body.private ?? false,
              auto_init: body.auto_init ?? true,
            }),
          });
          return Response.json({ repository: repo }, { status: 201 });
        } catch (error) {
          const status =
            error && typeof error === "object" && "status" in error
              ? Number((error as { status?: number }).status)
              : 500;
          return Response.json(
            {
              error: { message: error instanceof Error ? error.message : "GitHub request failed" },
            },
            { status },
          );
        }
      },
    },
  },
});
