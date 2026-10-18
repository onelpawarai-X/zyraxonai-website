import { createFileRoute } from "@tanstack/react-router";

/**
 * Desktop feedback intake.
 *
 * Two delivery channels, chosen by the client:
 *   - "issue" -> returns a prefilled GitHub "new issue" link. The visitor opens
 *                it while signed in to their OWN GitHub account and submits the
 *                issue themselves, so the site never needs a GitHub token and
 *                the issue is authored by the reporter.
 *   - "email" -> emails the team. When a mail provider is configured the message
 *                is sent server-side; otherwise the response carries a prefilled
 *                mailto: link that the browser opens directly.
 *
 * Nothing is stored in a database. The endpoint is public, so every field is
 * length-capped and validated, and a honeypot field drops trivial spam.
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

const REPO = "onelpawarai-X/ZYRAXON-AI";
const NEW_ISSUE = `https://github.com/${REPO}/issues/new`;
const TEAM_EMAIL = "sayidilxs@gmail.com";

/** GitHub rejects overly long query strings; keep the prefilled body bounded. */
const MAX_URL_BODY = 5000;

const CATEGORIES: Record<string, { label: string; title: string }> = {
  bug: { label: "bug", title: "Bug report" },
  feature: { label: "enhancement", title: "Feature request" },
  question: { label: "question", title: "Question" },
  docs: { label: "documentation", title: "Documentation" },
  other: { label: "", title: "Feedback" },
};

type Entry = {
  name: string;
  email: string;
  category: string;
  os: string;
  appVersion: string;
  message: string;
  github: string;
};

/** Drop control characters (keeping tab, newline and carriage return). */
function stripControl(value: string) {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue;
    out += ch;
  }
  return out;
}

function clean(value: unknown, max: number) {
  return stripControl(String(value ?? ""))
    .trim()
    .slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function issueTitle(entry: Entry) {
  const meta = CATEGORIES[entry.category] ?? CATEGORIES.other;
  return `[Desktop] ${meta.title}: ${entry.message.split("\n")[0].slice(0, 90)}`;
}

function buildIssueBody(entry: Entry) {
  const lines = [
    "### Desktop feedback",
    "",
    `**Category:** ${CATEGORIES[entry.category]?.title ?? "Feedback"}`,
    `**From:** ${entry.name}${entry.github ? ` (@${entry.github})` : ""}`,
    ...(entry.email ? [`**Contact email:** ${entry.email}`] : []),
    "",
    "### Environment",
    `- **OS:** ${entry.os || "not specified"}`,
    `- **App version:** ${entry.appVersion || "not specified"}`,
    "",
    "### Details",
    entry.message,
    "",
    "---",
    "_Submitted from the ZYRAXON AI desktop feedback page._",
  ];
  return lines.join("\n");
}

/**
 * Prefilled "new issue" link. The visitor is signed in to their own GitHub
 * account, so they author the issue and this endpoint needs no write token.
 */
function newIssueLink(entry: Entry) {
  const meta = CATEGORIES[entry.category] ?? CATEGORIES.other;
  const params = new URLSearchParams();
  params.set("title", issueTitle(entry));
  params.set("body", buildIssueBody(entry).slice(0, MAX_URL_BODY));
  if (meta.label) params.set("labels", meta.label);
  return `${NEW_ISSUE}?${params.toString()}`;
}

/** Prefilled mail-client link, used when no mail provider is configured. */
function mailtoLink(entry: Entry) {
  const meta = CATEGORIES[entry.category] ?? CATEGORIES.other;
  const subject = `[Desktop] ${meta.title} from ${entry.name}`;
  return `mailto:${TEAM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    buildIssueBody(entry),
  )}`;
}

async function sendEmail(entry: Entry): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ZYRAXON Feedback <onboarding@resend.dev>",
      to: [TEAM_EMAIL],
      reply_to: entry.email,
      subject: `[Desktop] ${CATEGORIES[entry.category]?.title ?? "Feedback"} from ${entry.name}`,
      text: buildIssueBody(entry),
    }),
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status})`);
  return true;
}

export const Route = createFileRoute("/api/public/desktop-feedback")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),

      GET: async () =>
        Response.json(
          {
            repo: `https://github.com/${REPO}/issues`,
            newIssue: NEW_ISSUE,
            categories: Object.entries(CATEGORIES).map(([value, meta]) => ({
              value,
              title: meta.title,
            })),
          },
          { headers: HEADERS },
        ),

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: HEADERS });
        }

        if (clean(body.company, 20)) {
          // Honeypot tripped: pretend success, store nothing.
          return Response.json({ ok: true }, { headers: HEADERS });
        }

        const mode = body.mode === "issue" ? "issue" : "email";
        const category = clean(body.category, 40);
        const entry: Entry = {
          name: clean(body.name, 80),
          email: clean(body.email, 120),
          category: CATEGORIES[category] ? category : "other",
          os: clean(body.os, 60),
          appVersion: clean(body.appVersion, 40),
          github: clean(body.github, 60).replace(/^@/, ""),
          message: clean(body.message, 6000),
        };

        if (!entry.message || entry.message.length < 10)
          return Response.json(
            { error: "Please describe your feedback in at least 10 characters." },
            { status: 400, headers: HEADERS },
          );
        if (!entry.name)
          return Response.json({ error: "Name is required." }, { status: 400, headers: HEADERS });
        if (mode === "email" && !isEmail(entry.email))
          return Response.json(
            { error: "A valid email is required." },
            { status: 400, headers: HEADERS },
          );
        if (body.consent !== true)
          return Response.json(
            { error: "Please accept the consent." },
            { status: 400, headers: HEADERS },
          );

        if (mode === "issue") {
          // Hand the browser a prefilled link. The visitor submits the issue
          // under their own GitHub account, so no token is required here.
          return Response.json(
            { ok: true, channel: "issue", issueUrl: newIssueLink(entry), repo: REPO },
            { headers: HEADERS },
          );
        }

        try {
          let emailed = false;
          try {
            emailed = await sendEmail(entry);
          } catch {
            emailed = false;
          }
          // No mail provider configured: hand the browser a prefilled mailto
          // link so the message still goes straight to the team inbox.
          return Response.json(
            emailed
              ? { ok: true, channel: "email" }
              : { ok: true, channel: "email", mailto: mailtoLink(entry) },
            { headers: HEADERS },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not send your feedback.";
          return Response.json({ error: message }, { status: 502, headers: HEADERS });
        }
      },
    },
  },
});
