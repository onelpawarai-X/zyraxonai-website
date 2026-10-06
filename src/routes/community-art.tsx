import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/community-art")({
  head: () => ({
    meta: [
      { title: "Community ART — ZYRAXON AI, Inc." },
      { name: "description", content: "Join the ZYRAXON AI community with a verified email and show your contribution profile." },
      { property: "og:title", content: "Community ART — ZYRAXON AI, Inc." },
      { property: "og:description", content: "Verified contributor profiles of the ZYRAXON AI community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityArt,
});

type Member = {
  id: string;
  name: string;
  role: string;
  country: string | null;
  skills: string | null;
  participation: string | null;
  institution: string | null;
  socialLinks: string | null;
  initial: string;
};

const input = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function CommunityArt() {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "form" | "done">("email");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "",
    role: "",
    country: "",
    skills: "",
    participation: "",
    address: "",
    phone: "",
    socialLinks: "",
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

    // চেক করুন ইউজার ইতিমধ্যে ভেরিফাইড কিনা
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setEmail(data.session.user.email);
        setStage("form");
      }
    });

    // ম্যাজিক লিঙ্ক বা ইমেইল বাটনে ক্লিক করে পেজে আসলে স্বয়ংক্রিয় ডিটেকশন
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setStage("form");
        setMsg("ইমেইল সফলভাবে ভেরিফাই হয়েছে! এবার আপনার তথ্য পূরণ করুন।");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function sendCode() {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) return;

    setBusy(true);
    setMsg("");

    const redirectUrl = typeof window !== "undefined"
      ? `${window.location.origin}/community-art`
      : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
      },
    });

    setBusy(false);
    if (error) {
      return setMsg(error.message);
    }

    setStage("code");
    setMsg("আপনার Gmail-এ ভেরিফিকেশন লিঙ্ক পাঠানো হয়েছে।");
  }

  async function verify() {
    const targetEmail = email.trim().toLowerCase();
    const token = code.trim();
    if (!token) return;

    setBusy(true);
    setMsg("");

    // 'email' বা 'signup' উভয় প্রকার টোকেনের সাথেই মিলিয়ে দেখা হয়
    let res = await supabase.auth.verifyOtp({
      email: targetEmail,
      token,
      type: "email",
    });

    if (res.error) {
      res = await supabase.auth.verifyOtp({
        email: targetEmail,
        token,
        type: "signup",
      });
    }

    setBusy(false);
    if (res.error) {
      return setMsg(res.error.message || "ভেরিফিকেশন কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।");
    }

    setStage("form");
    setMsg("ইমেইল সফলভাবে ভেরিফাই হয়েছে।");
  }

  async function submit() {
    setBusy(true);
    setMsg("");
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/public/community-act", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify(f),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || "প্রোফাইল সংরক্ষণ ব্যর্থ হয়েছে।");
    setStage("done");
    setMsg("ধন্যবাদ! আপনার প্রোফাইল তালিকায় যুক্ত হয়েছে।");
    load();
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← ZYRAXON AI
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Community ART</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          আপনার ইমেইল ভেরিফাই করে কমিউনিটিতে অংশ নিন। ঠিকানা, ফোন এবং ইমেইল সম্পূর্ণ গোপনীয় থাকবে।
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
                  placeholder="sayidilxs@gmail.com"
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
                  📩 <b>{email}</b> ঠিকানায় ইমেইল পাঠানো হয়েছে।
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <b>পদ্ধতি ১ (সবচেয়ে সহজ):</b> আপনার Gmail ইনবক্সে গিয়ে <b>[Verify Email]</b> বাটনে ক্লিক করুন—পেজ স্বয়ংক্রিয়ভাবে খুলে যাবে।
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <b>পদ্ধতি ২:</b> ইমেইলে কোনো কোড দেওয়া থাকলে নিচে লিখে ভেরিফাই করুন।
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
                  <span>ভেরিফাইড: <b>{email}</b></span>
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
                <input className={input} placeholder="Full name *" value={f.name} onChange={set("name")} />
                <input className={input} placeholder="Role (e.g. Developer, Designer)" value={f.role} onChange={set("role")} />
                <input className={input} placeholder="Educational institution" value={f.institution} onChange={set("institution")} />
                <input className={input} placeholder="Country" value={f.country} onChange={set("country")} />
                <input className={input} placeholder="Skills (comma separated)" value={f.skills} onChange={set("skills")} />
                <textarea
                  className={input}
                  rows={3}
                  placeholder="How do you participate / contribute?"
                  value={f.participation}
                  onChange={set("participation")}
                />
                <input className={input} placeholder="Social links (GitHub, LinkedIn…)" value={f.socialLinks} onChange={set("socialLinks")} />
                <input className={input} placeholder="Address (Private — শুধু অ্যাডমিন দেখবে)" value={f.address} onChange={set("address")} />
                <input className={input} placeholder="Phone (Private — শুধু অ্যাডমিন দেখবে)" value={f.phone} onChange={set("phone")} />
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={f.consent}
                    onChange={(e) => setF({ ...f, consent: e.target.checked })}
                  />
                  আমি আমার নাম, পদবি, প্রতিষ্ঠান ও সোশ্যাল লিঙ্ক পাবলিক প্রোফাইলে প্রদর্শন করার সম্মতি দিচ্ছি।
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
              <div className="rounded-lg bg-green-500/10 p-4 text-center text-sm text-green-500">
                🎉 ধন্যবাদ! আপনার তথ্য সফলভাবে কমিউনিটি তালিকায় যোগ হয়েছে।
              </div>
            )}

            {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Members ({members.length})</h2>
            {members.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">এখনো কোনো ভেরিফাইড সদস্য নেই। প্রথম সদস্য হিসেবে যোগ দিন।</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {members.map((m) => (
                <article key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary font-bold text-primary-foreground">
                      {m.initial}
                    </div>
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[m.role, m.institution, m.country].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                  {m.participation && <p className="mt-3 text-sm text-muted-foreground">{m.participation}</p>}
                  {m.skills && <p className="mt-2 text-xs">{m.skills}</p>}
                  {m.socialLinks && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {m.socialLinks
                        .split(/[\s,]+/)
                        .filter((u) => /^https:\/\//.test(u))
                        .map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-primary underline"
                          >
                            {new URL(u).hostname}
                          </a>
                        ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
