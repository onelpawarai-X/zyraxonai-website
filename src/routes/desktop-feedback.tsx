import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/site/PageShell";
import { PageHeader } from "@/components/site/SiteChrome";
import { ButtonAnchor, Card } from "@/components/site/ui";

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
  "w-full rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20";
const label = "block text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

type Channel = "email" | "issue";
type Result = { channel: string; issueUrl?: string } | null;

function DesktopFeedback() {
  const [channel, setChannel] = useState<Channel>("email");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  // Only mark fields red once the user has actually tried to submit, so a fresh
  // form does not look like it is already shouting at them.
  const [attempted, setAttempted] = useState(false);
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
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (error) setError("");
      setF((prev) => ({ ...prev, [k]: e.target.value }));
    };

  async function submit() {
    setMsg("");
    setAttempted(true);
    if (missing.length) {
      setError(`Please add ${missing.join(", ")}.`);
      return;
    }
    setError("");
    setBusy(true);
    // Open the tab right now, while the click still counts as a user gesture.
    // Calling window.open after `await fetch(...)` is treated as a popup by
    // most browsers and silently blocked, which is why the button looked dead.
    const tab = channel === "issue" ? window.open("about:blank", "_blank") : null;
    if (tab) tab.opener = null;

    let r: Response;
    try {
      r = await fetch("/api/public/desktop-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, mode: channel }),
      });
    } catch {
      tab?.close();
      setBusy(false);
      return setMsg("Network error. Please check your connection and try again.");
    }
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      tab?.close();
      return setMsg(d.error || "Something went wrong. Please try again.");
    }
    if (channel === "issue" && d.issueUrl) {
      setResult({ channel: "issue", issueUrl: d.issueUrl });
      setMsg(
        "Almost done — GitHub is opening with your report filled in. Sign in if needed, then press Submit new issue.",
      );
      if (tab && !tab.closed) tab.location.href = d.issueUrl;
      else window.open(d.issueUrl, "_blank", "noopener,noreferrer");
    } else if (d.mailto) {
      tab?.close();
      setResult({ channel: "email" });
      window.location.href = d.mailto;
      setMsg(`Opening your email app — send the message to ${TEAM_EMAIL}.`);
    } else {
      tab?.close();
      setResult({ channel: "email" });
      setMsg("Your feedback has been sent. Thank you!");
    }
  }

  // Fields the server will reject. We keep the button clickable on purpose:
  // a disabled button gives no clue why it does nothing, which reads as broken.
  // Instead the click tells the user exactly what is missing.
  const missing: string[] = [];
  if (!f.name.trim()) missing.push("your name");
  if (channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()))
    missing.push("a valid email address");
  if (f.message.trim().length < 10) missing.push("feedback of at least 10 characters");
  if (!f.consent) missing.push("the consent checkbox");

  const err = (bad: boolean) => (attempted && bad ? "border-red-500/60" : "");
  const errName = err(!f.name.trim());
  const errEmail = err(channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()));
  const errMsg = err(f.message.trim().length < 10);

  return (
    <PageShell>
      <PageHeader
        label="Support"
        title="Desktop feedback"
        description="Tell us what you think about the ZYRAXON desktop app — bugs, feature requests or questions. Email the team directly, or open a tracked GitHub issue anyone can follow."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setError("");
            setChannel("email");
          }}
          className={`zx-glass rounded-2xl p-5 text-left transition ${
            channel === "email" ? "border-primary/60 ring-2 ring-primary/20" : ""
          }`}
        >
          <div className="flex items-center gap-2 text-[14px] font-bold text-foreground">
            <span className="zx-glass grid h-8 w-8 place-items-center rounded-lg text-primary">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </span>
            Email the team
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Best for private feedback. The message goes to {TEAM_EMAIL}.
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setChannel("issue");
          }}
          className={`zx-glass rounded-2xl p-5 text-left transition ${
            channel === "issue" ? "border-primary/60 ring-2 ring-primary/20" : ""
          }`}
        >
          <div className="flex items-center gap-2 text-[14px] font-bold text-foreground">
            <span className="zx-glass grid h-8 w-8 place-items-center rounded-lg text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7 0-.7 0-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3z" />
              </svg>
            </span>
            Open a GitHub issue
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            Public and trackable. We open GitHub with your report filled in — submit it with your
            own account.
          </p>
        </button>
      </div>

      <Card className="mt-5 p-6 sm:p-7">
        {result ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-4">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
              <p className="text-[13.5px] leading-relaxed text-emerald-700 dark:text-emerald-300">
                {msg}
              </p>
            </div>
            {result.issueUrl && (
              <ButtonAnchor href={result.issueUrl} variant="glass" size="sm">
                Open the prefilled issue on GitHub
              </ButtonAnchor>
            )}
            <div>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setMsg("");
                  setError("");
                  setF({ ...f, message: "" });
                }}
                className="zx-chip rounded-full px-4 py-2 text-[13px] font-semibold text-foreground"
              >
                Send another feedback
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={label}>Your name *</span>
                <input
                  className={`${input} mt-1.5 ${errName}`}
                  value={f.name}
                  onChange={set("name")}
                  placeholder="Your name"
                />
              </div>
              <div>
                <span className={label}>{channel === "issue" ? "Email" : "Email *"}</span>
                <input
                  className={`${input} mt-1.5 ${errEmail}`}
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
                <select className={input + " mt-1.5"} value={f.category} onChange={set("category")}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Operating system</span>
                <select className={input + " mt-1.5"} value={f.os} onChange={set("os")}>
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
                  className={input + " mt-1.5"}
                  value={f.appVersion}
                  onChange={set("appVersion")}
                  placeholder="e.g. 19.0.5"
                />
              </div>
              <div>
                <span className={label}>GitHub username (optional)</span>
                <input
                  className={input + " mt-1.5"}
                  value={f.github}
                  onChange={set("github")}
                  placeholder="onelpawarai-X"
                />
              </div>
            </div>

            <div>
              <span className={label}>Your feedback *</span>
              <textarea
                className={`${input} mt-1.5 ${errMsg}`}
                rows={6}
                value={f.message}
                onChange={set("message")}
                placeholder="What happened, what you expected, and the steps to reproduce it."
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                At least 10 characters. The more detail you give, the faster we can fix it.
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

            <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={f.consent}
                onChange={(e) => {
                  setError("");
                  setF({ ...f, consent: e.target.checked });
                }}
              />
              <span>
                I agree that the ZYRAXON AI team may use the information I provide to process this
                feedback. {channel === "issue" && "GitHub issues are publicly visible."}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="zx-sheen inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
              >
                {busy ? "Preparing…" : channel === "issue" ? "Continue on GitHub" : "Send feedback"}
              </button>
              <ButtonAnchor href={`${REPO}/issues`} variant="ghost" size="sm">
                Browse all issues
              </ButtonAnchor>
            </div>

            {error && <p className="text-[13px] font-semibold text-red-500">{error}</p>}
            {msg && <p className="text-[13px] text-red-500">{msg}</p>}
          </div>
        )}
      </Card>

      <Card className="mt-5 p-5">
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Do not post security issues in a public issue. Email{" "}
          <a className="font-semibold text-primary underline" href={`mailto:${TEAM_EMAIL}`}>
            {TEAM_EMAIL}
          </a>{" "}
          instead.
        </p>
      </Card>
    </PageShell>
  );
}
