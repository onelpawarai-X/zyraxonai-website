import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { Card, Tag } from "@/components/site/ui";
import { supabase } from "@/integrations/supabase/client";
import { CommunityAvatar } from "@/components/community/CommunityAvatar";
import {
  COUNTRY_OPTIONS,
  LINK_PRESETS,
  ROLE_OPTIONS,
  SKILL_SUGGESTIONS,
  linkHost,
  linkLabel,
  type CommunityLink,
  type CommunityMember,
} from "@/lib/community";

export const Route = createFileRoute("/community-art")({
  head: () => ({
    meta: [
      { title: "Community — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Join the ZYRAXON AI community with a verified email, upload a profile picture, add your website and social links, and get a public profile page.",
      },
      { property: "og:title", content: "Community — ZYRAXON AI" },
      {
        property: "og:description",
        content: "Verified community profiles of the ZYRAXON AI community.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/community-art" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityArt,
});

const input =
  "w-full rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type LinkRow = { label: string; url: string; custom: boolean };

const emptyLink = (): LinkRow => ({ label: "Website", url: "", custom: false });

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function CommunityArt() {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "form" | "done">("email");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [links, setLinks] = useState<LinkRow[]>([emptyLink()]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    name: "",
    role: ROLE_OPTIONS[0],
    customRole: "",
    country: "",
    skills: "",
    participation: "",
    address: "",
    phone: "",
    institution: "",
    consent: false,
  });

  const load = () => {
    fetch("/api/public/community-act")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    load();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setEmail(data.session.user.email);
        setStage("form");
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setStage("form");
        setMsg("Email verified. Now fill in your details.");
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function sendCode() {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;
    setBusy(true);
    setMsg("");
    const redirectUrl =
      typeof window !== "undefined" ? `${window.location.origin}/community-art` : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: true, emailRedirectTo: redirectUrl },
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setStage("code");
    setMsg("We sent a verification link to your inbox.");
  }

  async function verify() {
    const targetEmail = email.trim().toLowerCase();
    const token = code.trim();
    if (!token) return;
    setBusy(true);
    setMsg("");
    let res = await supabase.auth.verifyOtp({ email: targetEmail, token, type: "email" });
    if (res.error) {
      res = await supabase.auth.verifyOtp({ email: targetEmail, token, type: "signup" });
    }
    setBusy(false);
    if (res.error) {
      return setMsg(res.error.message || "That code is not valid or has expired.");
    }
    setStage("form");
    setMsg("Email verified.");
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("Only images can be uploaded (PNG, JPG, WebP, GIF).");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMsg("The image must be under 2 MB.");
      return;
    }
    setMsg("");
    setAvatarPreview(await fileToDataUrl(file));
  }

  function updateLink(index: number, patch: Partial<LinkRow>) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setBusy(true);
    setMsg("");
    const role = f.role === "Other" ? f.customRole.trim() || "Member" : f.role;
    const payload = {
      name: f.name,
      role,
      country: f.country,
      skills: f.skills,
      participation: f.participation,
      address: f.address,
      phone: f.phone,
      institution: f.institution,
      consent: f.consent,
      avatar: avatarPreview,
      links: links
        .map((l) => ({ label: l.custom ? l.label.trim() : l.label, url: l.url.trim() }))
        .filter((l) => /^https?:\/\//i.test(l.url)),
    };
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/public/community-act", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || "Could not save your profile.");
    setStage("done");
    setMsg("Thank you! Your profile is now on the roster.");
    load();
  }

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.name, m.role, m.country, m.institution, m.skills]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [members, query]);

  return (
    <PageShell>
      <PageHeader
        label="Community"
        title="Join the roster"
        description="Verify your email to take part. Add a photo, your role, country, skills and links — your public profile is one click away for everyone. Address and phone stay private."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="p-6">
          {stage === "email" && (
            <div className="space-y-4">
              <div>
                <span className={labelCls}>Email address</span>
                <input
                  className={input + " mt-1.5"}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                />
              </div>
              <button
                type="button"
                disabled={busy || !email}
                onClick={sendCode}
                className="zx-sheen inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send verification link"}
              </button>
            </div>
          )}

          {stage === "code" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-primary/10 p-3.5 text-[12.5px] text-primary">
                We sent an email to <b>{email}</b>.
              </div>
              <div className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <p>
                  <b className="text-foreground">Option 1 (easiest):</b> open your inbox and click{" "}
                  <b>[Verify Email]</b> — the page opens automatically.
                </p>
                <p>
                  <b className="text-foreground">Option 2:</b> if the email contains a code, enter
                  it below.
                </p>
              </div>
              <div>
                <span className={labelCls}>One-time code (if provided)</span>
                <input
                  className={input + " mt-1.5 tracking-[0.3em]"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                />
              </div>
              <button
                type="button"
                disabled={busy || !code}
                onClick={verify}
                className="zx-sheen inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify code"}
              </button>
              <button
                type="button"
                onClick={() => setStage("email")}
                className="w-full text-[12.5px] text-muted-foreground hover:text-foreground"
              >
                Change email
              </button>
            </div>
          )}

          {stage === "form" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                <span className="min-w-0 truncate">
                  Verified: <b className="text-foreground">{email}</b>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setStage("email");
                  }}
                  className="shrink-0 text-primary underline"
                >
                  Sign out
                </button>
              </div>

              <div className="flex items-center gap-4">
                <CommunityAvatar name={f.name || "?"} src={avatarPreview || null} size={60} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="zx-chip rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-foreground"
                    >
                      Upload photo
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarPreview("");
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        className="text-[12px] text-muted-foreground underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    PNG, JPG, WebP · up to 2 MB
                  </p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onPickFile}
                />
              </div>

              <div>
                <span className={labelCls}>Full name *</span>
                <input
                  className={input + " mt-1.5"}
                  placeholder="Your name"
                  value={f.name}
                  onChange={set("name")}
                />
              </div>

              <div>
                <span className={labelCls}>Role</span>
                <select className={input + " mt-1.5"} value={f.role} onChange={set("role")}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {f.role === "Other" && (
                <input
                  className={input}
                  placeholder="Enter your role"
                  value={f.customRole}
                  onChange={set("customRole")}
                />
              )}

              <div>
                <span className={labelCls}>Institution</span>
                <input
                  className={input + " mt-1.5"}
                  placeholder="School, company or organisation"
                  value={f.institution}
                  onChange={set("institution")}
                />
              </div>

              <div>
                <span className={labelCls}>Country</span>
                <select className={input + " mt-1.5"} value={f.country} onChange={set("country")}>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className={labelCls}>Skills</span>
                <input
                  className={input + " mt-1.5"}
                  placeholder="Comma separated, e.g. TypeScript, LLM / Agents"
                  list="community-skills"
                  value={f.skills}
                  onChange={set("skills")}
                />
                <datalist id="community-skills">
                  {SKILL_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SKILL_SUGGESTIONS.slice(0, 14).map((s) => {
                    const picked = f.skills
                      .split(",")
                      .map((x) => x.trim().toLowerCase())
                      .includes(s.toLowerCase());
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const list = f.skills
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean);
                          const next = picked
                            ? list.filter((x) => x.toLowerCase() !== s.toLowerCase())
                            : [...list, s];
                          setF({ ...f, skills: next.join(", ") });
                        }}
                        className={`zx-chip rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          picked ? "bg-primary/15 text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {picked ? "✓ " : "+ "}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className={labelCls}>How do you contribute?</span>
                <textarea
                  className={input + " mt-1.5"}
                  rows={3}
                  placeholder="Tell the community what you work on"
                  value={f.participation}
                  onChange={set("participation")}
                />
              </div>

              <div className="zx-glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-foreground">Links</span>
                  <button
                    type="button"
                    onClick={() => setLinks((p) => [...p, emptyLink()])}
                    className="zx-chip rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-foreground"
                  >
                    + Add Link
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {links.map((l, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <select
                        className={input + " w-auto min-w-[130px]"}
                        value={l.label}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateLink(i, { label: v, custom: v === "Other" });
                        }}
                      >
                        {LINK_PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      {l.custom && (
                        <input
                          className={input + " w-auto flex-1"}
                          placeholder="Label"
                          value={l.label === "Other" ? "" : l.label}
                          onChange={(e) => updateLink(i, { label: e.target.value })}
                        />
                      )}
                      <input
                        className={input + " w-auto flex-1"}
                        placeholder="https://…"
                        value={l.url}
                        onChange={(e) => updateLink(i, { url: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setLinks((p) => p.filter((_, j) => j !== i))}
                        className="text-[12px] text-muted-foreground underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={labelCls}>Address (private)</span>
                  <input
                    className={input + " mt-1.5"}
                    placeholder="Only admins can see this"
                    value={f.address}
                    onChange={set("address")}
                  />
                </div>
                <div>
                  <span className={labelCls}>Phone (private)</span>
                  <input
                    className={input + " mt-1.5"}
                    placeholder="Only admins can see this"
                    value={f.phone}
                    onChange={set("phone")}
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={f.consent}
                  onChange={(e) => setF({ ...f, consent: e.target.checked })}
                />
                <span>
                  I agree to show my name, photo, role, institution and links on my public profile.
                </span>
              </label>

              <button
                type="button"
                disabled={busy || !f.name || !f.consent}
                onClick={submit}
                className="zx-sheen inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Join community"}
              </button>
            </div>
          )}

          {stage === "done" && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-500/10 p-5 text-center">
                <p className="text-[14px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Your profile is live
                </p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Thank you for joining the ZYRAXON community.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStage("form")}
                className="zx-chip inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-foreground"
              >
                Edit profile
              </button>
            </div>
          )}

          {msg && <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">{msg}</p>}
        </Card>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Members <span className="text-muted-foreground">({filtered.length})</span>
            </h2>
            <input
              className={input + " max-w-[240px]"}
              placeholder="Search members…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {members.length === 0 && (
            <Card className="mt-4 p-8 text-center">
              <p className="text-[13.5px] text-muted-foreground">
                No verified members yet. Be the first to join.
              </p>
            </Card>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {filtered.map((m) => (
              <Card key={m.id} hover className="flex flex-col p-5">
                <Link
                  to="/community/$id"
                  params={{ id: m.id }}
                  className="flex items-center gap-3.5"
                >
                  <CommunityAvatar name={m.name} seed={m.id} src={m.avatarUrl} size={48} />
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold text-foreground">
                      {m.name}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {[m.role, m.institution, m.country].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </Link>
                {m.participation && (
                  <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                    {m.participation}
                  </p>
                )}
                {m.skills && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.skills
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((s) => (
                        <Tag key={s}>{s}</Tag>
                      ))}
                  </div>
                )}
                {m.links?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.links.slice(0, 4).map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="zx-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-primary"
                      >
                        {linkLabel(l)}
                      </a>
                    ))}
                  </div>
                )}
                <Link
                  to="/community/$id"
                  params={{ id: m.id }}
                  className="mt-4 text-[12.5px] font-semibold text-primary"
                >
                  View profile →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
