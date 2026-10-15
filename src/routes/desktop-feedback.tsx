import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/desktop-feedback")({
  head: () => ({
    meta: [
      { title: "Desktop Feedback — ZYRAXON AI" },
      {
        name: "description",
        content:
          "Send feedback about the ZYRAXON desktop agent. Email the team directly or open a tracked GitHub issue — bug reports, feature requests and questions are all welcome.",
      },
      { property: "og:title", content: "Desktop Feedback — ZYRAXON AI" },
      {
        property: "og:description",
        content: "Email the team or open a GitHub issue with your ZYRAXON desktop feedback.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://zyraxonai.lovable.app/desktop-feedback" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesktopFeedback,
});

const REPO = "https://github.com/onelpawarai-X/ZYRAXON-AI";
const TEAM_EMAIL = "sayidilxs@gmail.com";

const CATEGORIES = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "question", label: "Question" },
  { value: "docs", label: "Documentation" },
  { value: "other", label: "Something else" },
];

const OS_OPTIONS = ["Windows 10/11", "macOS (Apple Silicon)", "macOS (Intel)", "Linux", "Other"];

const input =
  "w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const label = "block text-xs font-semibold tracking-wide text-muted-foreground uppercase";

type Channel = "email" | "issue";
type Result = { channel: string; issue?: { number: number; url: string } } | null;

function DesktopFeedback() {
  const [channel, setChannel] = useState<Channel>("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [f, setF] = useState({
    name: "",
    email: "",
    category: "bug",
    os: "",
    appVersion: "",
    github: "",
    message: "",
    consent: false,
    company: "",
  });

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF({ ...f, [k]: e.target.value });

  async function submit() {
    setBusy(true);
    setMsg("");
    setResult(null);
    const r = await fetch("/api/public/desktop-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, mode: channel }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error || "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।");
    setResult({ channel: d.channel, issue: d.issue });
    if (channel === "issue") {
      setMsg("আপনার GitHub ইস্যু তৈরি হয়েছে। ধন্যবাদ!");
    } else if (d.mailto) {
      // No server-side mail provider: open the prefilled mail draft.
      window.location.href = d.mailto;
      setMsg(`আপনার ইমেইল অ্যাপ খোলা হচ্ছে — মেসেজটি ${TEAM_EMAIL} ঠিকানায় পাঠিয়ে দিন।`);
    } else {
      setMsg("আপনার ফিডব্যাক পাঠানো হয়েছে। ধন্যবাদ!");
    }
  }

  const disabled = busy || !f.name || !f.message || f.message.length < 10 || !f.consent;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← ZYRAXON AI
        </Link>

        <h1 className="mt-4 text-4xl font-bold tracking-tight">Desktop Feedback</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          আপনার ZYRAXON ডেস্কটপ অ্যাপ নিয়ে মতামত, বাগ বা নতুন ফিচারের অনুরোধ পাঠান। ইমেইল করে
          টিমের কাছে পৌঁছাতে পারেন, অথবা সরাসরি GitHub ইস্যু খুলতে পারেন যাতে সবাই ট্র্যাক করতে
          পারে।
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setChannel("email")}
            className={`rounded-2xl border p-5 text-left transition ${
              channel === "email" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"
            }`}
          >
            <div className="text-sm font-bold">📧 Email the team</div>
            <p className="mt-1 text-xs text-muted-foreground">
              গোপনীয় ফিডব্যাকের জন্য ভালো। আমরা {TEAM_EMAIL} এ আপনার মেসেজ পাব।
            </p>
          </button>
          <button
            onClick={() => setChannel("issue")}
            className={`rounded-2xl border p-5 text-left transition ${
              channel === "issue" ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"
            }`}
          >
            <div className="text-sm font-bold">🐙 Open a GitHub issue</div>
            <p className="mt-1 text-xs text-muted-foreground">
              পাবলিক ও ট্র্যাকযোগ্য। বাগ রিপোর্ট ও ফিচার রিকোয়েস্টের জন্য সেরা।
            </p>
          </button>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6">
          {result ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-green-500/10 p-4 text-sm text-green-600">{msg}</div>
              {result.issue && (
                <a
                  href={result.issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-semibold text-primary underline"
                >
                  Issue #{result.issue.number} দেখুন →
                </a>
              )}
              <div>
                <button
                  onClick={() => {
                    setResult(null);
                    setMsg("");
                    setF({ ...f, message: "" });
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
                >
                  আরেকটি ফিডব্যাক পাঠান
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>Your name *</span>
                  <input className={input + " mt-1"} value={f.name} onChange={set("name")} placeholder="Your name" />
                </div>
                <div>
                  <span className={label}>{channel === "issue" ? "Email" : "Email *"}</span>
                  <input
                    className={input + " mt-1"}
                    type="email"
                    value={f.email}
                    onChange={set("email")}
                    placeholder="you@gmail.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>Category</span>
                  <select className={input + " mt-1"} value={f.category} onChange={set("category")}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={label}>Operating system</span>
                  <select className={input + " mt-1"} value={f.os} onChange={set("os")}>
                    <option value="">Select…</option>
                    {OS_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className={label}>App version</span>
                  <input
                    className={input + " mt-1"}
                    value={f.appVersion}
                    onChange={set("appVersion")}
                    placeholder="e.g. 19.0.5"
                  />
                </div>
                <div>
                  <span className={label}>GitHub username (optional)</span>
                  <input
                    className={input + " mt-1"}
                    value={f.github}
                    onChange={set("github")}
                    placeholder="onelpawarai-X"
                  />
                </div>
              </div>

              <div>
                <span className={label}>Your feedback *</span>
                <textarea
                  className={input + " mt-1"}
                  rows={6}
                  value={f.message}
                  onChange={set("message")}
                  placeholder="What happened, what you expected, and the steps to reproduce it."
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  কমপক্ষে ১০ অক্ষর। যত বিস্তারিত দিবেন, তত দ্রুত সমাধান সম্ভব।
                </p>
              </div>

              {/* Honeypot: hidden from humans, filled by bots. */}
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="hidden"
                value={f.company}
                onChange={set("company")}
              />

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={f.consent}
                  onChange={(e) => setF({ ...f, consent: e.target.checked })}
                />
                আমি সম্মতি দিচ্ছি যে আমার দেওয়া তথ্য ZYRAXON AI টিম ফিডব্যাক প্রক্রিয়ার জন্য ব্যবহার
                করতে পারবে।{" "}
                {channel === "issue" && "GitHub ইস্যু পাবলিকভাবে দেখা যাবে।"}
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  disabled={disabled}
                  onClick={submit}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy
                    ? "পাঠানো হচ্ছে..."
                    : channel === "issue"
                      ? "Open GitHub issue"
                      : "Send feedback"}
                </button>
                <a
                  href={`${REPO}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground underline"
                >
                  সব ইস্যু দেখুন
                </a>
              </div>

              {msg && <p className="text-sm text-red-500">{msg}</p>}
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-muted-foreground">
          নিরাপত্তা সংক্রান্ত সমস্যা পাবলিক ইস্যুতে লিখবেন না — সরাসরি{" "}
          <a className="underline" href={`mailto:${TEAM_EMAIL}`}>
            {TEAM_EMAIL}
          </a>{" "}
          এ ইমেইল করুন।
        </p>
      </div>
    </main>
  );
}
