import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type ProjectFile = { path: string; content: string };

function githubToken(request: Request): string {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function sanitizeRepoName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "zyraxon-project"
  );
}

async function github(path: string, token: string, init?: RequestInit) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
  });
}

export const Route = createFileRoute("/api/public/github/publish")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const token = githubToken(request);
        if (!token)
          return Response.json(
            { error: "GitHub OAuth token required" },
            { status: 401, headers: CORS },
          );

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
        }

        const repoName = sanitizeRepoName(String(body?.repoName || "zyraxon-project"));
        const isPrivate = Boolean(body?.private);
        const files: ProjectFile[] = Array.isArray(body?.files)
          ? body.files
              .filter(
                (file: unknown) =>
                  file && typeof file.path === "string" && typeof file.content === "string",
              )
              .slice(0, 500)
          : [];

        if (!files.length)
          return Response.json(
            { error: "At least one project file is required" },
            { status: 400, headers: CORS },
          );

        const userResponse = await github("/user", token);
        if (!userResponse.ok)
          return Response.json(
            { error: "GitHub authentication failed" },
            { status: 401, headers: CORS },
          );
        const user: unknown = await userResponse.json();

        let repoResponse = await github(
          `/repos/${encodeURIComponent(user.login)}/${encodeURIComponent(repoName)}`,
          token,
        );
        let repo: unknown;

        if (repoResponse.ok) {
          repo = await repoResponse.json();
          if (repo.private !== isPrivate) {
            await github(
              `/repos/${encodeURIComponent(user.login)}/${encodeURIComponent(repoName)}`,
              token,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ private: isPrivate }),
              },
            );
          }
        } else if (repoResponse.status === 404) {
          repoResponse = await github("/user/repos", token, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: repoName, private: isPrivate, auto_init: true }),
          });
          if (!repoResponse.ok) {
            const detail = await repoResponse.text();
            return Response.json(
              { error: "Could not create GitHub repository", detail: detail.slice(0, 1000) },
              { status: repoResponse.status, headers: CORS },
            );
          }
          repo = await repoResponse.json();
        } else {
          const detail = await repoResponse.text();
          return Response.json(
            { error: "Could not inspect GitHub repository", detail: detail.slice(0, 1000) },
            { status: repoResponse.status, headers: CORS },
          );
        }

        const branch = repo.default_branch || "main";
        for (const file of files) {
          const encodedPath = file.path.split("/").map(encodeURIComponent).join("/");
          const existing = await github(
            `/repos/${encodeURIComponent(user.login)}/${encodeURIComponent(repoName)}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
            token,
          );
          const existingData: unknown = existing.ok ? await existing.json() : null;

          const payload: Record<string, unknown> = {
            message: `ZYRAXON AI: update ${file.path}`,
            content: base64Utf8(file.content),
            branch,
          };
          if (existingData?.sha) payload.sha = existingData.sha;

          const update = await github(
            `/repos/${encodeURIComponent(user.login)}/${encodeURIComponent(repoName)}/contents/${encodedPath}`,
            token,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );
          if (!update.ok) {
            const detail = await update.text();
            return Response.json(
              { error: `Failed to publish ${file.path}`, detail: detail.slice(0, 1000) },
              { status: update.status, headers: CORS },
            );
          }
        }

        return Response.json(
          {
            ok: true,
            repository: repo.full_name,
            url: repo.html_url,
            branch,
            filesPublished: files.length,
          },
          { headers: CORS },
        );
      },
    },
  },
});
