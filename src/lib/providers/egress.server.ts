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

/** Next egress address, round-robin. Returns undefined for direct mode, which
 *  callers treat as "no override". */
export function nextEgress(): string | undefined {
  if (!PROXIES.length) return undefined;
  const url = PROXIES[cursor % PROXIES.length];
  cursor = (cursor + 1) >>> 0;
  return url;
}

/** Assign an egress address to a lane, derived from the lane's session id so a
 *  lane keeps the same address for its whole turn (a mid-turn address change
 *  would look like two clients to the upstream). */
export function egressFor(sessionId: string): string | undefined {
  if (!PROXIES.length) return undefined;
  let h = 0x811c9dc5;
  for (let i = 0; i < sessionId.length; i++)
    h = Math.imul(h ^ sessionId.charCodeAt(i), 0x01000193) >>> 0;
  return PROXIES[h % PROXIES.length];
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
  return {
    mode: "pool",
    proxies: PROXIES.length,
    spread: PROXIES.length > 1,
    note: `Traffic is spread across ${PROXIES.length} egress address${PROXIES.length === 1 ? "" : "es"} in round-robin order.`,
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
    return (await fetch(url, { ...init, dispatcher } as any)) as Response;
  } finally {
    // Release the agent's sockets; a pooled agent per call would otherwise hold
    // connections open for every request the process ever served.
    await dispatcher.close?.().catch(() => {});
  }
}
