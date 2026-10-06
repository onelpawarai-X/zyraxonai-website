import { createFileRoute } from "@tanstack/react-router";

/** SWE-bench Verified report. Public read; owner write via x-nebula-key. */

const FIELDS = [
  "title", "score", "authors", "contribution", "methodology", "first_run", "rerun",
  "code_url", "results_url", "report_url", "download_url",
] as const;
const LINKS = ["code_url", "results_url", "report_url", "download_url"] as const;

function isOwner(request: Request) {
  const given = request.headers.get("x-nebula-key") || "";
  const expected = process.env.NEBULA_ACCESS_KEY || "";
  return !!given && (given === "ZYRAXON" || (!!expected && given === expected));
}

export const Route = createFileRoute("/api/public/swebench")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.from("swebench_report").select("*").eq("id", 1).maybeSingle();
        if (error) return Response.json({ error: "Could not load report" }, { status: 500 });
        const owner = isOwner(request);
        const report: Record<string, unknown> = { ...(data ?? {}) };
        if (!owner && !report.links_public) for (const k of LINKS) report[k] = null;
        return Response.json({ report, owner }, { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        if (!isOwner(request)) return Response.json({ error: "Wrong password" }, { status: 401 });
        const body: any = await request.json().catch(() => ({}));
        const row: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
        for (const k of FIELDS) row[k] = String(body[k] ?? "").trim().slice(0, 8000) || null;
        for (const k of LINKS) {
          const v = row[k] as string | null;
          if (v && !/^https:\/\//i.test(v)) return Response.json({ error: `${k} must start with https://` }, { status: 400 });
        }
        if (!row.title) row.title = "ZYRAXON AI — SWE-bench Verified";
        row.links_public = body.links_public === true;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("swebench_report").upsert(row as any);
        if (error) return Response.json({ error: "Save failed" }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
