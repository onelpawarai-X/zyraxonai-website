import { createFileRoute } from "@tanstack/react-router";

/**
 * Desktop feedback intake.
 *
 * Two delivery channels, chosen by the client:
 *   - "issue" -> opens a GitHub issue on the ZYRAXON-AI repository.
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
const TEAM_EMAIL = "sayidilxs@gmail.com";

const CATEGORIES: Record<string, { label: string; title: string }> = {
  bug: { label: "bug", title: "Bug report" },
  feature: { label: "enhancement", title: "Feature request" },
  question: { label: "question", title: "Question" },
  docs: { label: "documentation", title: "Documentation" },
  other: { label: "", title: "Feedback" },
};

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .trim()
    .slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function gh(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "zyraxon-website",
    "Content-Type": "application/json",
  };
}

function buildIssueBody(entry: {
  name: string;
  email: string;
  category: string;
  os: string;
  appVersion: string;
  message: string;
  github: string;
}) {
  const lines = [
    "### Desktop feedback",
    "",
    `**Category:** ${CATEGORIES[entry.category]?.title ?? "Feedback"}`,
    `**From:** ${entry.name}${entry.github ? ` (@${entry.github})` : ""}`,
    `**Contact email:** ${entry.email}`,
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

async function createIssue(
  token: string,
  entry: Parameters<typeof buildIssueBody>[0],
): Promise<{ number: number; url: string }> {
  const meta = CATEGORIES[entry.category] ?? CATEGORIES.other;
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: gh(token),
    body: JSON.stringify({
      title: `[Desktop] ${meta.title}: ${entry.message.split("\n")[0].slice(0, 90)}`,
      body: buildIssueBody(entry),
      ...(meta.label ? { labels: [meta.label] } : {}),
    }),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `GitHub issue failed (${res.status})`);
  return { number: data.number, url: data.html_url };
}

async function sendEmail(entry: {
  name: string;
  email: string;
  category: string;
  os: string;
  appVersion: string;
  message: string;
  github: string;
}): Promise<boolean> {
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

/** Prefilled mail-client link, used when no mail provider is configured. */
function mailtoLink(entry: {
  name: string;
  email: string;
  category: string;
  os: string;
  appVersion: string;
  message: string;
  github: string;
}) {
  const subject = `[Desktop] ${CATEGORIES[entry.category]?.title ?? "Feedback"} from ${entry.name}`;
  const body = buildIssueBody(entry);
  return `mailto:${TEAM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const Route = createFileRoute("/api/public/desktop-feedback")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: HEADERS }),

      GET: async () =>
        Response.json(
          {
            repo: `https://github.com/${REPO}/issues`,
            newIssue: `https://github.com/${REPO}/issues/new`,
            categories: Object.entries(CATEGORIES).map(([value, meta]) => ({
              value,
              title: meta.title,
            })),
          },
          { headers: HEADERS },
        ),

      POST: async ({ request }) => {
        let body: any;
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
        const entry = {
          name: clean(body.name, 80),
          email: clean(body.email, 120),
          category: CATEGORIES[body.category] ? body.category : "other",
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
          return Response.json({ error: "A valid email is required." }, { status: 400, headers: HEADERS });
        if (body.consent !== true)
          return Response.json({ error: "Please accept the consent." }, { status: 400, headers: HEADERS });

        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

        if (mode === "issue") {
          if (!token)
            return Response.json(
              { error: "Issue creation is unavailable right now. Please use the email option." },
              { status: 503, headers: HEADERS },
            );
          try {
            const issue = await createIssue(token, entry);
            return Response.json({ ok: true, channel: "issue", issue }, { headers: HEADERS });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Could not open the issue.";
            return Response.json({ error: message }, { status: 502, headers: HEADERS });
          }
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
