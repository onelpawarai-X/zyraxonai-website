/** Egress selection for upstream calls.
 *
 *  A session fingerprint isolates callers from each other's rate limits, but it
 *  does not change *where* the requests come from. Every lane in one process
 *  still leaves through one IP, and an upstream that throttles per IP sees a
 *  single client no matter how many lanes are open. Spreading the load across
 *  egress addresses is therefore a deployment concern, not something a rotation
 *  loop can fix, and this module is where that concern is expressed.
 *
 *  Two modes:
 *
 *  - `direct`  — no proxy configured. All traffic uses the host's own IP.
 *  - `pool`    — `ZYRAXON_EGRESS_URLS` lists proxy endpoints. Lanes are assigned
 *                round-robin, so N lanes spread over M proxies, and no single
 *                egress address carries the whole deployment.
 *
 *  With no pool configured the honest answer is that the deployment has one
 *  egress IP and the upstream may throttle it. `egressStatus()` says so instead
 *  of implying capacity that is not there.
 */

export type EgressMode = "direct" | "pool";

export type EgressStatus = {
  mode: EgressMode;
  proxies: number;
  /** True when more than one egress address is available. */
  spread: boolean;
  note: string;
};

const raw = (process.env.ZYRAXON_EGRESS_URLS || "").trim();

/** Parsed once at module load: a proxy list that changes mid-process would
 *  silently move traffic between addresses, which is harder to reason about
 *  than a restart. */
const PROXIES: string[] = raw
  ? raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

let cursor = 0;

/** Addresses that recently reported a rate limit or spent quota.
 *
 *  The upstream's free limiter counts per address, so an address that has just
 *  refused a request will refuse the next one too. Sending the next turn there
 *  anyway is what turns one limited address into a failed turn for whoever
 *  happens to hash to it. Keeping the address out of circulation for a while
 *  moves the load onto addresses that can still serve, which is the whole
 *  reason for holding more than one. */
const egressCooldownUntil = new Map<string, number>();
const EGRESS_COOLDOWN_MS = Number(process.env.ZYRAXON_EGRESS_COOLDOWN_MS || 600_000);

export function noteEgressLimited(url: string, ms = EGRESS_COOLDOWN_MS): void {
  if (url) egressCooldownUntil.set(url, Date.now() + ms);
}

export function egressLimited(url: string): boolean {
  const until = egressCooldownUntil.get(url);
  return typeof until === "number" && until > Date.now();
}

/** Addresses that can still serve, in round-robin order. When every address is
 *  cooling the whole pool is returned: an address that might still answer beats
 *  refusing the turn outright, and the caller's rotation can retry. */
function healthyProxies(): string[] {
  const ready = PROXIES.filter((p) => !egressLimited(p));
  return ready.length ? ready : PROXIES;
}

/** Next egress address, round-robin over the healthy ones. Returns undefined
 *  for direct mode, which callers treat as "no override". */
export function nextEgress(): string | undefined {
  if (!PROXIES.length) return undefined;
  const pool = healthyProxies();
  const url = pool[cursor % pool.length];
  cursor = (cursor + 1) >>> 0;
  return url;
}

/** Forget a session's address. Called when the address it holds is found to be
 *  over its limit, so the next call for that turn is allocated a fresh one. */
export function releaseEgress(sessionId: string): void {
  sessionEgress.delete(sessionId);
}

/** Assign an egress address to a lane, derived from the lane's session id so a
 *  lane keeps the same address for its whole turn (a mid-turn address change
 *  would look like two clients to the upstream).
 *
 *  The hash is taken over the *healthy* subset, so callers spread across the
 *  addresses that can actually serve rather than being pinned to one that has
 *  just been limited. A lane already in flight keeps the address it started on
 *  because its own call resolves the pool once. */
/** Address handed to a session, remembered for the life of that session.
 *
 *  Two calls for the same turn must leave by the same address — a mid-turn
 *  change looks like two clients to the upstream and breaks a stream — but two
 *  different turns should not: the whole point of a pool is that consecutive
 *  requests do not share an address, so the upstream's per-address limiter
 *  never sees the same client twice in a row. A short-lived memo gives both:
 *  the first call for a turn takes the next address in rotation, later calls
 *  for that same turn reuse it. */
const sessionEgress = new Map<string, { url: string; at: number }>();
const SESSION_EGRESS_TTL_MS = 15 * 60_000;

function remember(sid: string, url: string): string {
  sessionEgress.set(sid, { url, at: Date.now() });
  // Keep the map from growing without bound over a long-lived process.
  if (sessionEgress.size > 20_000) {
    const cutoff = Date.now() - SESSION_EGRESS_TTL_MS;
    for (const [k, v] of sessionEgress) if (v.at < cutoff) sessionEgress.delete(k);
  }
  return url;
}

export function egressFor(sessionId: string): string | undefined {
  if (!PROXIES.length) return undefined;
  const held = sessionEgress.get(sessionId);
  if (held && Date.now() - held.at < SESSION_EGRESS_TTL_MS && !egressLimited(held.url)) {
    return held.url;
  }
  // Round-robin over the healthy addresses, so consecutive turns differ.
  const pool = healthyProxies();
  const url = pool[cursor % pool.length];
  cursor = (cursor + 1) >>> 0;
  return remember(sessionId, url);
}

export function egressStatus(): EgressStatus {
  if (!PROXIES.length) {
    return {
      mode: "direct",
      proxies: 0,
      spread: false,
      note: "One egress IP. Callers are isolated by session fingerprint, but the upstream still sees one address; set ZYRAXON_EGRESS_URLS to spread traffic across proxies.",
    };
  }
  const cooling = PROXIES.filter((p) => egressLimited(p)).length;
  return {
    mode: "pool",
    proxies: PROXIES.length,
    spread: PROXIES.length > 1,
    note:
      `Traffic is spread across ${PROXIES.length} egress address${PROXIES.length === 1 ? "" : "es"} in round-robin order` +
      (cooling ? `; ${cooling} cooling down after a rate limit.` : "."),
  };
}

/** Fetch through a specific egress address.
 *
 *  Node's `ProxyAgent` is installed per dispatcher, and the global dispatcher is
 *  process-wide — sharing it would let one lane's proxy leak into another lane's
 *  request. So the dispatcher is created per call and passed explicitly. The
 *  module is imported lazily because `undici` is a Node built-in here but is not
 *  present in an edge runtime; a bundler that tree-shakes the direct path never
 *  pulls it in. */
export async function egressFetch(
  url: string,
  init: RequestInit,
  proxy?: string,
): Promise<Response> {
  if (!proxy) return fetch(url, init);
  const { ProxyAgent } = (await import("undici")) as any;
  const dispatcher = new ProxyAgent(proxy);
  try {
    const res = (await fetch(url, { ...init, dispatcher } as any)) as Response;
    // The upstream told us, on the wire, that this address is over its limit.
    // Remember it here, at the one place every upstream response passes
    // through, so the next turn leaves by a different address instead of
    // rediscovering the same wall.
    if (res.status === 429) noteEgressLimited(proxy);
    return res;
  } finally {
    // Release the agent's sockets; a pooled agent per call would otherwise hold
    // connections open for every request the process ever served.
    await dispatcher.close?.().catch(() => {});
  }
}
