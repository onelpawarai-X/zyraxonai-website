import { createFileRoute } from "@tanstack/react-router";

/**
 * Community ART roster.
 * GET: public roster (no email, phone or address are ever returned).
 * POST: requires a Bearer token from an email-OTP verified session; the stored
 * email always comes from the verified session, never from the request body.
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
};

const AVATAR_BUCKET = "community-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, max);
}

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

type PublicLink = { label: string; url: string };

/** Links are stored as a JSON array; older rows may still hold free text. */
function parseLinks(raw: unknown): PublicLink[] {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        const label = clean((entry as any)?.label, 40);
        const url = clean((entry as any)?.url, 300);
        return { label, url };
      })
      .filter((l) => /^https?:\/\//i.test(l.url));
  }
  const text = clean(raw, 1000);
  if (!text) return [];
  return text
    .split(/[\s,]+/)
    .filter((u) => /^https?:\/\//i.test(u))
    .map((url) => ({ label: "", url }));
}

async function saveAvatar(
  supabaseAdmin: any,
  userId: string,
  dataUrl: string,
): Promise<string | null> {
  const match = /^data:(image\/[a-z+.-]+);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = IMAGE_TYPES[mime];
  if (!ext) throw new Error("Unsupported image type");
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) throw new Error("Image must be under 2 MB");
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return (data?.publicUrl as string) ?? null;
}

export const Route = createFileRoute("/api/public/community-act")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),

      GET: async ({ request }) => {
        try {
          const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 200, 500);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const base = "id, name, role, country, skills, participation, institution, social_links, joined_at";
          let query = supabaseAdmin
            .from("community_members")
            .select(`${base}, links, avatar_url`)
            .eq("email_verified", true)
            .order("joined_at", { ascending: false })
            .limit(limit);
          let res = await query;
          // Columns may not exist yet on an older database; fall back gracefully.
          if (res.error) {
            res = (await supabaseAdmin
              .from("community_members")
              .select(base)
              .eq("email_verified", true)
              .order("joined_at", { ascending: false })
              .limit(limit)) as typeof res;
          }
          const data = res.data as any[] | null;
          if (res.error) throw res.error;
          const members = (data ?? []).map((r: any) => ({
            id: r.id,
            name: r.name,
            role: r.role,
            country: r.country,
            skills: r.skills,
            participation: r.participation,
            institution: r.institution,
            socialLinks: r.social_links,
            links: parseLinks(r.links ?? r.social_links),
            avatarUrl: r.avatar_url ?? null,
            initial: initialOf(r.name ?? ""),
            joinedAt: r.joined_at,
          }));
          return Response.json({ members, count: members.length }, { headers: HEADERS });
        } catch (err) {
          return Response.json({ members: [], error: String(err) }, { status: 500, headers: HEADERS });
        }
      },

      POST: async ({ request }) => {
        try {
          const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          if (!token)
            return Response.json({ error: "Verify your email first" }, { status: 401, headers: HEADERS });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: auth, error: authErr } = await supabaseAdmin.auth.getUser(token);
          const user = auth?.user;
          if (authErr || !user?.email || !user.email_confirmed_at)
            return Response.json({ error: "Email is not verified" }, { status: 401, headers: HEADERS });

          const body: any = await request.json().catch(() => ({}));
          const name = clean(body.name, 80);
          if (!name) return Response.json({ error: "Name is required" }, { status: 400, headers: HEADERS });
          if (body.consent !== true)
            return Response.json({ error: "Please accept the consent" }, { status: 400, headers: HEADERS });

          let avatarUrl: string | null = null;
          const avatar = typeof body.avatar === "string" ? body.avatar : "";
          if (avatar.startsWith("data:")) {
            try {
              avatarUrl = await saveAvatar(supabaseAdmin, user.id, avatar);
            } catch (err) {
              const message = err instanceof Error ? err.message : "Avatar upload failed";
              return Response.json({ error: message }, { status: 400, headers: HEADERS });
            }
          } else if (/^https:\/\//i.test(avatar)) {
            avatarUrl = avatar.slice(0, 500);
          }

          const links = parseLinks(body.links).slice(0, 12);

          const row: Record<string, unknown> = {
            user_id: user.id,
            email: user.email.toLowerCase(),
            email_verified: true,
            name,
            role: clean(body.role, 60) || "Member",
            country: clean(body.country, 60) || null,
            skills: clean(body.skills, 240) || null,
            participation: clean(body.participation, 2000) || null,
            address: clean(body.address, 300) || null,
            phone: clean(body.phone, 30) || null,
            institution: clean(body.institution, 160) || null,
            social_links: links.map((l) => l.url).join("\n") || null,
            links: links.length ? JSON.stringify(links) : null,
            consented_at: new Date().toISOString(),
          };
          if (avatarUrl) row.avatar_url = avatarUrl;

          let { data, error } = await supabaseAdmin
            .from("community_members")
            .upsert(row as any, { onConflict: "email" })
            .select("id, name, role, country, institution, avatar_url, links")
            .single();

          // Older databases may not have the avatar_url / links columns yet.
          if (error && /column|schema cache/i.test(error.message || "")) {
            const fallback = { ...row };
            delete fallback.avatar_url;
            delete fallback.links;
            ({ data, error } = await supabaseAdmin
              .from("community_members")
              .upsert(fallback as any, { onConflict: "email" })
              .select("id, name, role, country, institution, social_links")
              .single());
          }
          if (error) throw error;
          return Response.json({ ok: true, member: data }, { headers: HEADERS });
        } catch {
          return Response.json(
            { error: "Could not save your entry right now. Please try again." },
            { status: 500, headers: HEADERS },
          );
        }
      },
    },
  },
});
