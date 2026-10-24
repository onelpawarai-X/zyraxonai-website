/** Upstream credential pool and quota handling.
 *
 *  Kept apart from the request builder so the pool can be reasoned about and
 *  tested without pulling in the prompt text or any network module. */

/** Every upstream credential the deployment holds.
 *
 *  A free tier's quota belongs to the *account*, not to the caller: one key
 *  exhausted means every caller through that key is refused, no matter how
 *  isolated their sessions are. The only way to serve a hundred thousand
 *  callers from a free tier is to hold more than one account and spread the
 *  load, so the pool is read from the environment as a list. A single key is
 *  still a pool of one, and a caller-supplied key is preferred when present. */
export function upstreamKeys(): string[] {
  if (typeof process === "undefined") return [];
  const raw = [
    process.env.OPENCODE_ZEN_API_KEYS,
    process.env.OPENCODE_ZEN_API_KEY,
    process.env.OPENCODE_API_KEY,
  ]
    .filter(Boolean)
    .join(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const k = part.trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/** True when a failure means the *account* is out of quota rather than the
 *  model being unavailable. The distinction matters: a retired model should be
 *  routed around, but a spent quota must be rotated away from at the credential
 *  level, and no amount of retrying the same key will clear it. */
export function isQuotaFailure(detail: unknown): boolean {
  const s = String(detail ?? "");
  // `FreeUsageLimitError` is the upstream's own name for a spent window, and is
  // what makes re-asking worthwhile. The bare `FreeTierError` type name is
  // deliberately absent: the identity refusal carries it too, and matching it
  // here made a permanent gate look like a momentary limit, so a caller was
  // re-asked twenty times for a refusal no re-ask could ever clear. The two
  // predicates are disjoint, and that is what lets the turn tell them apart.
  return /usage limit|quota|subscribe to opencode|FreeUsageLimitError|insufficient|billing/i.test(s);
}

/** Per-key cooldown. A key that reported a spent quota is set aside for a
 *  while so the next turns spend their budget on a key that can still serve,
 *  instead of rediscovering the same wall on every request. */
const keyCooldownUntil = new Map<string, number>();
const KEY_COOLDOWN_MS = Number(process.env.ZYRAXON_KEY_COOLDOWN_MS || 90_000);

export function noteKeyLimited(key: string, ms = KEY_COOLDOWN_MS): void {
  if (key) keyCooldownUntil.set(key, Date.now() + ms);
}

export function keyLimited(key: string): boolean {
  const until = keyCooldownUntil.get(key);
  return typeof until === "number" && until > Date.now();
}

/** Pick the credential a turn should spend.
 *
 *  A caller-supplied key wins — it is that caller's own quota. Otherwise the
 *  pool is scanned for a key that is not cooling down; when every key is
 *  cooling, the one whose cooldown expires soonest is used anyway, because a
 *  refusal on a real key is still better than refusing without asking. */
export function pickUpstreamKey(userKey?: string): string | undefined {
  const own = userKey?.trim();
  if (own) return own;
  const pool = upstreamKeys();
  if (!pool.length) return undefined;
  const ready = pool.find((k) => !keyLimited(k));
  if (ready) return ready;
  let best = pool[0];
  let bestUntil = keyCooldownUntil.get(best) ?? 0;
  for (const k of pool) {
    const until = keyCooldownUntil.get(k) ?? 0;
    if (until < bestUntil) {
      best = k;
      bestUntil = until;
    }
  }
  return best;
}
