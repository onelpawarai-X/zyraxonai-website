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
  id: string; name: string; role: string; country: string | null; skills: string | null;
  participation: string | null; institution: string | null; socialLinks: string | null; initial: string;
};

const input = "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

function CommunityArt() {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code" | "form" | "done">("email");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", role: "", country: "", skills: "", participation: "", address: "", phone: "", socialLinks: "", institution: "", consent: false });

  const load = () => fetch("/api/public/community-act").then((r) => r.json()).then((d) => setMembers(d.members ?? [])).catch(() => {});
  useEffect(() => {
    load();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.email_confirmed_at) { setEmail(data.session.user.email ?? ""); setStage("form"); }
    });
  }, []);

  async function sendCode() {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setMsg(error.message);
    setStage("code"); setMsg("A verification code was sent to your email.");
  }
  async function verify() {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setMsg(error.message);
    setStage("form"); setMsg("Email verified.");
  }
  async function submit() {
    setBusy(true); setMsg("");
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/public/community-act", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(f),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || "Failed");
    setStage("done"); setMsg("Your profile is now listed."); load();
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← ZYRAXON AI</Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Community ART</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Verify your email, tell us how you contribute, and your public profile appears below. Address, phone and email stay private.</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {stage === "email" && (<>
              <label className="text-sm font-medium">Email</label>
              <input className={input + " mt-1"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
              <button disabled={busy || !email} onClick={sendCode} className="mt-4 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Send verification code</button>
            </>)}
            {stage === "code" && (<>
              <label className="text-sm font-medium">Code sent to {email}</label>
              <input className={input + " mt-1 tracking-widest"} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
              <button disabled={busy || !code} onClick={verify} className="mt-4 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Verify email</button>
              <button onClick={() => setStage("email")} className="mt-2 w-full text-xs text-muted-foreground">Change email</button>
            </>)}
            {stage === "form" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Verified: {email}</p>
                <input className={input} placeholder="Full name *" value={f.name} onChange={set("name")} />
                <input className={input} placeholder="Role (e.g. Developer, Designer)" value={f.role} onChange={set("role")} />
                <input className={input} placeholder="Educational institution" value={f.institution} onChange={set("institution")} />
                <input className={input} placeholder="Country" value={f.country} onChange={set("country")} />
                <input className={input} placeholder="Skills" value={f.skills} onChange={set("skills")} />
                <textarea className={input} rows={3} placeholder="How do you participate / contribute?" value={f.participation} onChange={set("participation")} />
                <input className={input} placeholder="Social links (GitHub, LinkedIn…)" value={f.socialLinks} onChange={set("socialLinks")} />
                <input className={input} placeholder="Address (private)" value={f.address} onChange={set("address")} />
                <input className={input} placeholder="Phone (private)" value={f.phone} onChange={set("phone")} />
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
                  I agree to show my name, role, institution, skills and social links publicly.
                </label>
                <button disabled={busy || !f.name || !f.consent} onClick={submit} className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Join community</button>
              </div>
            )}
            {stage === "done" && <p className="text-sm">Thank you — you're in the community roster.</p>}
            {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
          </section>

          <section>
            <h2 className="text-lg font-semibold">Members ({members.length})</h2>
            {members.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No verified members yet. Be the first.</p>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {members.map((m) => (
                <article key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{m.initial}</div>
                    <div>
                      <div className="font-semibold">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{[m.role, m.institution, m.country].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                  {m.participation && <p className="mt-3 text-sm text-muted-foreground">{m.participation}</p>}
                  {m.skills && <p className="mt-2 text-xs">{m.skills}</p>}
                  {m.socialLinks && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {m.socialLinks.split(/[\s,]+/).filter((u) => /^https:\/\//.test(u)).map((u) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">{new URL(u).hostname}</a>
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
