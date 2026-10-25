/** The site helper's second backend: one long-lived OpenHands conversation.
 *
 *  Our own provider is tried first. When every brand has failed — which is what
 *  happens when the shared free pool is spent, and is exactly the outage that
 *  took the assistant down before — the helper falls back to an OpenHands
 *  conversation instead of giving up.
 *
 *  One conversation serves the whole site, deliberately:
 *
 *  - Starting a conversation provisions a sandbox, which takes tens of seconds.
 *    Doing that per message would make the assistant unusably slow and would
 *    leave a sandbox behind for every question asked.
 *  - So the first visitor's message creates it and every later message is sent
 *    into the same conversation, which is also what gives the assistant a
 *    continuous memory of what has been asked.
 *
 *  Turns are serialised. One conversation can only work on one message at a time,
 *  so two visitors asking at once would otherwise be answered out of order. The
 *  second waits for the first, which is a queue, not a failure.
 *
 *  A conversation that breaks — sandbox gone, errored, or gone quiet — is deleted
 *  and replaced, so the assistant heals itself rather than staying dead. */

import { helperConversationPrompt, PROMPT_SIGNATURE } from "./helper-prompt.server";

const BASE = (process.env.OPENHANDS_API_BASE || "https://app.all-hands.dev").replace(/\/+$/, "");

/** How long to wait for a new conversation to become ready, and for an answer. */
const READY_TIMEOUT_MS = Number(process.env.ZYRAXON_HELPER_CONVERSATION_READY_MS || 120_000);
const ANSWER_TIMEOUT_MS = Number(process.env.ZYRAXON_HELPER_CONVERSATION_ANSWER_MS || 90_000);
/** How often to look for the reply while the agent works.
 *
 *  Each poll is a cheap read (~0.5s) and the reply usually lands in one to three
 *  seconds, so a long interval is pure added latency on every turn: at 2.5s a
 *  reply that arrived at 1.9s was reported at 4.4s. Short enough to be prompt,
 *  long enough not to hammer the events endpoint. */
const POLL_MS = Number(process.env.ZYRAXON_HELPER_CONVERSATION_POLL_MS || 700);

/** The title that marks a conversation as this backend's, and lets a later run
 *  find and take it over instead of creating another one. */
const TITLE = "ZYRAXON site helper";

function apiKey(): string {
  return (process.env.OPENHANDS_API_KEY || "").trim();
}

/** Whether the OpenHands backend is configured at all. */
export function conversationConfigured(): boolean {
  return apiKey().length > 0;
}

type Conversation = {
  id: string;
  /** The id of the last chat message seen in this conversation.
   *
   *  A reply is any agent message that appears after this one. Tracking the id
   *  rather than a count is what keeps a turn matched to its question once the
   *  conversation is longer than the 100 events the API will return: an id can
   *  still be found or missed explicitly, while a count silently means something
   *  different as older events fall out of the window. */
  lastMessageId: string | null;
};

/** The conversation every visitor shares, or null before the first message. */
let current: Conversation | null = null;

/** The in-flight creation, so two callers cannot start two conversations. */
let starting: Promise<Conversation | null> | null = null;

/** When a creation last failed, and why it is not worth retrying yet.
 *
 *  The account has a daily cap on new sandboxes, and a conversation needs one.
 *  Once the cap is reached every attempt is refused, so retrying on each message
 *  would add a failed round trip to every visitor's answer for the rest of the
 *  day. Remembering the refusal for a while turns that into one failure and then
 *  an immediate, honest "we are down" for the rest. */
let failedAt = 0;
let failureReason = "";
const START_COOLDOWN_MS = Number(process.env.ZYRAXON_HELPER_CONVERSATION_COOLDOWN_MS || 300_000);

/** The tail of the turn queue, so turns run one at a time. */
let queue: Promise<unknown> = Promise.resolve();

async function oh(path: string, init: RequestInit = {}): Promise<Response> {
  const key = apiKey();
  return fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
}

/** Read the chat messages in a conversation, oldest first.
 *
 *  Only `MessageEvent`s with text are returned: state updates, system prompts and
 *  tool events share the same feed and are not part of the conversation.
 *
 *  The API caps `limit` at 100 and answers 422 above it — not a smaller page, a
 *  refusal — so asking for more returns nothing at all and the helper would see
 *  an empty conversation forever. 100 is the documented maximum and is used
 *  verbatim. */
async function messages(
  id: string,
): Promise<Array<{ id: string; source: string; text: string }>> {
  const res = await oh(`/conversation/${id}/events/search?limit=100`);
  if (!res.ok) return [];
  const data: any = await res.json().catch(() => null);
  const items: any[] = Array.isArray(data) ? data : data?.items || [];
  const out: Array<{ id: string; source: string; text: string }> = [];
  for (const e of items) {
    if (e?.kind !== "MessageEvent") continue;
    const content = e?.llm_message?.content;
    const text = Array.isArray(content)
      ? content
          .map((c: any) => (typeof c?.text === "string" ? c.text : ""))
          .join("")
          .trim()
      : typeof content === "string"
        ? content.trim()
        : "";
    if (!text) continue;
    out.push({ id: String(e?.id || ""), source: String(e?.source || ""), text });
  }
  return out;
}

/** Delete a conversation, ignoring the outcome.
 *
 *  Cleanup runs on the failure path, where the useful thing is to get to a fresh
 *  conversation. A delete that itself fails must not stop that. */
async function discard(id: string): Promise<void> {
  try {
    await oh(`/app-conversations/${id}`, { method: "DELETE" });
  } catch {
    /* the conversation is being abandoned either way */
  }
}

/** Start a conversation and wait until it can accept a message.
 *
 *  Returns null when it never becomes ready, which the caller treats as "this
 *  backend is unavailable" rather than an error to show. */
async function start(): Promise<Conversation | null> {
  let res: Response;
  try {
    res = await oh("/app-conversations", {
      method: "POST",
      body: JSON.stringify({
        // The identity and answer rules are fixed at creation: this backend has
        // no per-turn system message, so the prompt has to be installed once and
        // stand alone. It is the same prompt the brand path uses.
        //
        // No `initial_message`: a greeting sent at creation is an agent reply
        // that lands *after* the baseline is taken, so the first visitor's
        // question would be answered with that greeting. Leaving it out also
        // saves a whole model turn on every cold start, which is most of the
        // time the visitor used to spend waiting.
        system_prompt: helperConversationPrompt(),
        ...(process.env.ZYRAXON_HELPER_CONVERSATION_MODEL
          ? { llm_model: process.env.ZYRAXON_HELPER_CONVERSATION_MODEL.trim() }
          : {}),
        title: TITLE,
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const task: any = await res.json().catch(() => null);
  const taskId = task?.id;
  if (!taskId) return null;

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const t = await oh(`/app-conversations/start-tasks?ids=${taskId}`);
    if (!t.ok) continue;
    const data: any = await t.json().catch(() => null);
    const item = Array.isArray(data) ? data[0] : data?.items?.[0];
    const id = item?.app_conversation_id;
    if (id) {
      // Baseline the last message, so the greeting the conversation writes on
      // creation is not mistaken for the answer to the first visitor's question.
      const existing = await messages(id);
      console.log(`[zyraxon-helper] conversation ready: ${id}`);
      return { id, lastMessageId: existing.at(-1)?.id ?? null };
    }
    if (item?.status === "ERROR" || item?.status === "FAILED") return null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Whether the shared conversation is still usable.
 *
 *  A paused sandbox is fine — OpenHands resumes it when the next message arrives.
 *  A missing one, or a conversation that errored, is not, and is replaced. */
async function alive(conv: Conversation): Promise<boolean> {
  const res = await oh(`/app-conversations?ids=${conv.id}`);
  if (!res.ok) return false;
  const data: any = await res.json().catch(() => null);
  const item = Array.isArray(data) ? data[0] : data?.items?.[0];
  if (!item) return false;
  const sandbox = String(item.sandbox_status || "").toUpperCase();
  const exec = String(item.execution_status || "").toLowerCase();
  if (sandbox === "MISSING" || sandbox === "ERROR") return false;
  if (exec === "error" || exec === "failed") return false;
  return true;
}

/** Find conversations this backend created, newest first.
 *
 *  The upstream has a small cap on live conversations, and a deployment restarts
 *  and moves between isolates, so a conversation can be left behind with nothing
 *  pointing at it. Without this, each restart created another one until the cap
 *  was reached and every new attempt was refused — the helper then failed fast
 *  with nowhere to go, which is exactly the outage it exists to prevent. */
async function listOwn(): Promise<Array<{ id: string; at: string }>> {
  const res = await oh(`/app-conversations/search?limit=50`);
  if (!res.ok) return [];
  const data: any = await res.json().catch(() => null);
  const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
  return items
    .filter((i) => i?.title === TITLE && typeof i?.id === "string")
    .map((i) => ({ id: i.id as string, at: String(i.created_at || "") }))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** A conversation id fixed by configuration.
 *
 *  `current` lives in the module, and a serverless deployment runs several
 *  isolates — each with its own memory — so two visitors arriving on different
 *  isolates both see "no conversation" and each create one. That is a second
 *  source of the duplicate conversations, and it cannot be fixed from inside one
 *  isolate. Pinning the id in the environment does fix it: every isolate adopts
 *  the same conversation instead of racing to create one. Unset by default, so
 *  the search-based behaviour is unchanged when the pin is not configured. */
const PINNED_ID = (process.env.ZYRAXON_HELPER_CONVERSATION_ID || "").trim();

/** Take over an existing conversation, or clear the leftovers and start one.
 *
 *  Preferring an existing conversation over a fresh one matters twice over:
 *  creating one costs the visitor about 25 seconds, and each one occupies a slot
 *  the account has a fixed number of.
 *
 *  The system prompt is checked before adopting. A conversation's prompt is
 *  fixed when it is created, so one left over from an older build would answer
 *  from a stale catalogue — the identity rules and endpoint list would silently
 *  be last week's. A mismatch retires it instead. */
async function adoptOrStart(): Promise<Conversation | null> {
  const wanted = helperConversationPrompt();

  if (PINNED_ID) {
    const pinned: Conversation = { id: PINNED_ID, lastMessageId: null };
    if ((await alive(pinned)) && (await promptMatches(PINNED_ID, wanted))) {
      const existing = await messages(PINNED_ID);
      return { id: PINNED_ID, lastMessageId: existing.at(-1)?.id ?? null };
    }
    // A pinned conversation that is gone falls through to the search rather
    // than being deleted here: the pin cannot be rewritten from the server, so
    // the useful move is to find the newest healthy one and use that.
  }

  for (const found of await listOwn()) {
    const candidate: Conversation = { id: found.id, lastMessageId: null };
    if (!(await alive(candidate)) || !(await promptMatches(found.id, wanted))) {
      await discard(found.id);
      continue;
    }
    const existing = await messages(found.id);
    return { id: found.id, lastMessageId: existing.at(-1)?.id ?? null };
  }
  return start();
}

/** Whether a conversation was created with the current prompt.
 *
 *  The stored prompt is never byte-identical to the submitted one: OpenHands
 *  appends its own blocks (browser rules, tool descriptions) and may rewrap the
 *  text. An equality check therefore fails on every conversation, and the old
 *  code's "mismatch means retire it" turned that into delete-and-recreate on
 *  every restart — a fresh sandbox per message, which is both the slow turn and
 *  the pile of conversations. The check is a substring test on the version marker
 *  the prompt carries, which survives the upstream's own additions. */
async function promptMatches(id: string, _wanted: string): Promise<boolean> {
  const res = await oh(`/conversation/${id}/events/search?limit=100`);
  if (!res.ok) return false;
  const data: any = await res.json().catch(() => null);
  const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
  const event = items.find((e) => e?.kind === "SystemPromptEvent");
  const text = event?.system_prompt?.text;
  if (typeof text !== "string") return false;
  // A conversation with no marker predates the marker; it is retired once, and
  // the replacement carries the marker for every adoption after that.
  return text.includes(PROMPT_SIGNATURE);
}

/** The shared conversation, started if needed and replaced if broken.
 *
 *  Only one creation runs at a time. Two visitors arriving together would
 *  otherwise each see no conversation and each start one, which is exactly the
 *  "a new conversation per message" behaviour this module exists to prevent.
 *  The second caller waits on the first's promise instead. */
async function ensure(): Promise<Conversation | null> {
  if (current && (await alive(current))) return current;
  if (current) {
    const dead = current.id;
    current = null;
    await discard(dead);
  }
  if (!starting) {
    starting = adoptOrStart()
      .then((conv) => {
        if (conv) {
          failedAt = 0;
          failureReason = "";
        } else {
          failedAt = Date.now();
          failureReason = "the conversation backend could not be started";
        }
        return conv;
      })
      .finally(() => {
        starting = null;
      });
  }
  return starting;
}

/** Begin creating the conversation without waiting for it.
 *
 *  Creating one provisions a sandbox and takes ~25s. The brand pass runs first
 *  and usually fails, so warming in parallel with it means the conversation is
 *  already on its way by the time the helper needs it — the visitor pays one
 *  wait instead of two. Fire and forget: a failure here is not an error, only a
 *  slower fallback. */
export function warmConversation(): void {
  if (!conversationConfigured()) return;
  // Nothing to warm while the last attempt is still in its cooldown.
  if (failedAt && Date.now() - failedAt < START_COOLDOWN_MS) return;
  void ensure().catch(() => undefined);
}

/** A short, honest reason the conversation backend is unavailable, or null when
 *  it is usable or has not been tried yet. */
export function conversationUnavailable(): string | null {
  if (!conversationConfigured()) return null;
  if (failedAt && Date.now() - failedAt < START_COOLDOWN_MS) return failureReason;
  return null;
}

/** Send one message and wait for the assistant's reply.
 *
 *  Returns null when the backend could not answer, including when the
 *  conversation had to be abandoned. The caller treats null as "no answer from
 *  this backend" and moves on, so a failure here never throws inside the
 *  helper's stream. */
export async function askConversation(message: string): Promise<string | null> {
  if (!conversationConfigured()) return null;

  const run = async (): Promise<string | null> => {
    // Skip a start we know will be refused. The brand pass has already failed
    // and the conversation backend has nothing left to give, so the visitor
    // gets the honest answer now instead of after another failed attempt.
    if (conversationUnavailable()) return null;

    const conv = await ensure();
    if (!conv) return null;

    let sent: Response;
    try {
      sent = await oh(`/app-conversations/${conv.id}/send-message`, {
        method: "POST",
        body: JSON.stringify({
          role: "user",
          content: [{ type: "text", text: message }],
          run: true,
        }),
      });
    } catch {
      sent = new Response(null, { status: 0 });
    }

    // A refused send means the conversation is gone. Replace it and try once
    // more, so a sandbox that expired between turns costs one extra attempt
    // rather than the visitor's answer.
    if (!sent.ok) {
      const dead = conv.id;
      current = null;
      await discard(dead);
      const fresh = await ensure();
      if (!fresh) return null;
      try {
        const retry = await oh(`/app-conversations/${fresh.id}/send-message`, {
          method: "POST",
          body: JSON.stringify({
            role: "user",
            content: [{ type: "text", text: message }],
            run: true,
          }),
        });
        if (!retry.ok) return null;
        return await awaitReply(fresh);
      } catch {
        return null;
      }
    }

    return await awaitReply(conv);
  };

  // Serialise: the shared conversation works on one message at a time, and a
  // reply must be matched to the message that caused it.
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** Wait for an agent message that appears after the conversation's last known one.
 *
 *  Position is found by id, not by count, so a conversation long enough to push
 *  older messages out of the 100-event window still resolves correctly: the
 *  baseline either appears in the window (and everything after it is new) or it
 *  does not (and the newest agent message is the reply). */
async function awaitReply(conv: Conversation): Promise<string | null> {
  const deadline = Date.now() + ANSWER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const all = await messages(conv.id);
    if (!all.length) continue;

    const mark = conv.lastMessageId ? all.findIndex((m) => m.id === conv.lastMessageId) : -1;
    const fresh = mark >= 0 ? all.slice(mark + 1) : all;
    const answer = [...fresh].reverse().find((m) => m.source === "agent" && m.text);
    if (answer) {
      conv.lastMessageId = all.at(-1)?.id ?? conv.lastMessageId;
      return answer.text;
    }
    // Only the visitor's own message so far: keep waiting.
  }
  // No answer in time. The conversation is left in place rather than discarded:
  // a turn that ran long is usually a cold sandbox waking up, and the next
  // message into a warm conversation is fast. Deleting it here would pay the
  // ~25s setup again and, with the account's small sandbox cap, burn a slot —
  // which is how a slow turn turned into a pile of conversations.
  return null;
}
