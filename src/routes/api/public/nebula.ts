import { createFileRoute } from "@tanstack/react-router";
import { platform, arch, cpus, totalmem, freemem, uptime } from "node:os";
import { version } from "node:process";
import { resolveReleases } from "./downloads";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const NEBULA_PASSWORD = "zyraxon";

type SystemInfo = {
  platform: string;
  arch: string;
  cpus: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
  uptime: number;
  nodeVersion: string;
};

function getSystemInfo(): SystemInfo {
  return {
    platform: platform(),
    arch: arch(),
    cpus: cpus().length,
    totalMemoryGB: Math.round((totalmem() / 1073741824) * 10) / 10,
    freeMemoryGB: Math.round((freemem() / 1073741824) * 10) / 10,
    uptime: Math.round(uptime()),
    nodeVersion: version,
  };
}

export const Route = createFileRoute("/api/public/nebula")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action");

        if (action === "verify") {
          const password = url.searchParams.get("password");
          if (password === NEBULA_PASSWORD) {
            return Response.json(
              { success: true, token: btoa(`nebula:${Date.now()}`) },
              { headers: CORS },
            );
          }
          return Response.json(
            { success: false, error: "Invalid password" },
            { status: 401, headers: CORS },
          );
        }

        if (action === "system") {
          const password = url.searchParams.get("password");
          if (password !== NEBULA_PASSWORD) {
            return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
          }
          const info = getSystemInfo();
          return Response.json({ success: true, system: info }, { headers: CORS });
        }

        if (action === "releases") {
          try {
            const data = await resolveReleases();
            return Response.json({ success: true, releases: data }, { headers: CORS });
          } catch (err) {
            return Response.json({ success: false, error: String(err) }, { headers: CORS });
          }
        }

        return Response.json(
          { error: "Unknown action. Use ?action=verify|system|releases" },
          { status: 400, headers: CORS },
        );
      },
    },
  },
});
