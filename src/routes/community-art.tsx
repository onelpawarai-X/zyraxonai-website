import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

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
        setMsg("ইমেইল সফলভাবে ভেরিফাই হয়েছে! এবার আপনার তথ্য পূরণ করুন।");
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
    setMsg("আপনার Gmail-এ ভেরিফিকেশন লিঙ্ক পাঠানো হয়েছে।");
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
      return setMsg(res.error.message || "ভেরিফিকেশন কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।");
    }
    setStage("form");
    setMsg("ইমেইল সফলভাবে ভেরিফাই হয়েছে।");
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg("শুধু ছবি (PNG, JPG, WebP, GIF) আপলোড করা যাবে।");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMsg("ছবির আকার ২ MB এর কম হতে হবে।");
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
    if (!r.ok) return setMsg(d.error || "প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।");
    setStage("done");
    setMsg("ধন্যবাদ! আপনার প্রোফাইল তালিকায় যুক্ত হয়েছে।");
    load();
  }

  const set =
    (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← ZYRAXON AI
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Community</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          আপনার ইমেইল ভেরিফাই করে কমিউনিটিতে অংশ নিন। ছবি, ওয়েবসাইট ও সোশ্যাল লিঙ্ক যোগ করুন —
          আপনার প্রোফাইলে ক্লিক করলেই সবার সেই তথ্য দেখা যাবে। ঠিকানা, ফোন এবং ইমেইল সম্পূর্ণ
          গোপনীয় থাকবে।
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {stage === "email" && (
              <>
                <label className="text-sm font-medium">Email Address</label>
                <input
                  className={input + " mt-1"}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                />
                <button
                  disabled={busy || !email}
                  onClick={sendCode}
                  className="mt-4 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "পাঠানো হচ্ছে..." : "ভেরিফিকেশন লিঙ্ক পাঠান"}
                </button>
              </>
            )}

            {stage === "code" && (
              <>
                <div className="rounded-lg bg-primary/10 p-3 text-xs text-primary">
                  📩 <b>{email}</b> ঠিকানায় ইমেইল পাঠানো হয়েছে।
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <b>পদ্ধতি ১ (সবচেয়ে সহজ):</b> আপনার Gmail ইনবক্সে গিয়ে <b>[Verify Email]</b>{" "}
                    বাটনে ক্লিক করুন—পেজ স্বয়ংক্রিয়ভাবে খুলে যাবে।
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <b>পদ্ধতি ২:</b> ইমেইলে কোনো কোড দেওয়া থাকলে নিচে লিখে ভেরিফাই করুন।
                  </p>
                </div>
                <label className="mt-4 block text-xs font-medium">ওটিপি কোড (যদি থাকে)</label>
                <input
                  className={input + " mt-1 tracking-widest"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                />
                <button
                  disabled={busy || !code}
                  onClick={verify}
                  className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "যাচাই হচ্ছে..." : "Verify Code"}
                </button>
                <button
                  onClick={() => setStage("email")}
                  className="mt-3 w-full text-xs text-muted-foreground hover:underline"
                >
                  ইমেইল পরিবর্তন করুন
                </button>
              </>
            )}

            {stage === "form" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    ভেরিফাইড: <b>{email}</b>
                  </span>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setStage("email");
                    }}
                    className="text-primary underline"
                  >
                    লগআউট
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <CommunityAvatar name={f.name || "?"} src={avatarPreview || null} size={56} />
                  <div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                    >
                      প্রোফাইল ছবি আপলোড
                    </button>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarPreview("");
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        className="ml-2 text-xs text-muted-foreground underline"
                      >
                        সরান
                      </button>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPG, WebP · সর্বোচ্চ ২ MB</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={onPickFile}
                  />
                </div>

                <input className={input} placeholder="Full name *" value={f.name} onChange={set("name")} />

                <select className={input} value={f.role} onChange={set("role") as any}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {f.role === "Other" && (
                  <input
                    className={input}
                    placeholder="আপনার পদবি লিখুন"
                    value={f.customRole}
                    onChange={set("customRole")}
                  />
                )}

                <input
                  className={input}
                  placeholder="Educational institution"
                  value={f.institution}
                  onChange={set("institution")}
                />

                <select className={input} value={f.country} onChange={set("country") as any}>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <input
                  className={input}
                  placeholder="Skills (comma separated)"
                  list="community-skills"
                  value={f.skills}
                  onChange={set("skills")}
                />
                <datalist id="community-skills">
                  {SKILL_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>

                <textarea
                  className={input}
                  rows={3}
                  placeholder="How do you participate / contribute?"
                  value={f.participation}
                  onChange={set("participation")}
                />

                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Links</span>
                    <button
                      type="button"
                      onClick={() => setLinks((p) => [...p, emptyLink()])}
                      className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-accent"
                    >
                      + Add Link
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
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
                          className="text-xs text-muted-foreground underline"
                        >
                          সরান
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <input
                  className={input}
                  placeholder="Address (Private — শুধু অ্যাডমিন দেখবে)"
                  value={f.address}
                  onChange={set("address")}
                />
                <input
                  className={input}
                  placeholder="Phone (Private — শুধু অ্যাডমিন দেখবে)"
                  value={f.phone}
                  onChange={set("phone")}
                />
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={f.consent}
                    onChange={(e) => setF({ ...f, consent: e.target.checked })}
                  />
                  আমি আমার নাম, ছবি, পদবি, প্রতিষ্ঠান ও লিঙ্ক পাবলিক প্রোফাইলে প্রদর্শন করার সম্মতি
                  দিচ্ছি।
                </label>
                <button
                  disabled={busy || !f.name || !f.consent}
                  onClick={submit}
                  className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "সংরক্ষণ হচ্ছে..." : "Join community"}
                </button>
              </div>
            )}

            {stage === "done" && (
              <div className="space-y-3">
                <div className="rounded-lg bg-green-500/10 p-4 text-center text-sm text-green-600">
                  🎉 ধন্যবাদ! আপনার প্রোফাইল সফলভাবে যোগ হয়েছে।
                </div>
                <button
                  onClick={() => setStage("form")}
                  className="w-full rounded-lg border border-border py-2 text-sm font-semibold hover:bg-accent"
                >
                  প্রোফাইল এডিট করুন
                </button>
              </div>
            )}

            {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Members ({filtered.length})</h2>
              <input
                className={input + " max-w-[220px]"}
                placeholder="Search members…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {members.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                এখনো কোনো ভেরিফাইড সদস্য নেই। প্রথম সদস্য হিসেবে যোগ দিন।
              </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {filtered.map((m) => (
                <article
                  key={m.id}
                  className="rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
                >
                  <Link to="/community/$id" params={{ id: m.id }} className="flex items-center gap-3">
                    <CommunityAvatar name={m.name} seed={m.id} src={m.avatarUrl} size={44} />
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[m.role, m.institution, m.country].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </Link>
                  {m.participation && (
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{m.participation}</p>
                  )}
                  {m.skills && <p className="mt-2 text-xs">{m.skills}</p>}
                  {m.links?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {m.links.slice(0, 4).map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-primary underline"
                        >
                          {linkLabel(l)}
                        </a>
                      ))}
                    </div>
                  )}
                  <Link
                    to="/community/$id"
                    params={{ id: m.id }}
                    className="mt-3 inline-block text-xs font-semibold text-primary"
                  >
                    View profile →
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
