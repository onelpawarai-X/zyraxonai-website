/** Per-request session identity for the upstream free tier.
 *
 *  The free-tier gate keys its limits on a session fingerprint carried in the
 *  `x-opencode-session` / `x-opencode-session-id` headers. A single process-wide
 *  id therefore gives every caller one shared fate: the first rate limit or ban
 *  hits the whole deployment at once. Each request gets its own id here instead.
 *
 *  The gate only accepts ids whose first twelve hex characters decode to a
 *  creation time, so the timestamp is encoded rather than hashed.
 */
const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Encode a millisecond epoch the way the upstream identifier scheme expects:
 *  bitwise-not of the shifted value, six big-endian bytes, hex. */
export function encodeTimestamp(timestamp: number): string {
  const value = ~(BigInt(timestamp) * 0x1000n);
  return Array.from({ length: 6 }, (_, index) =>
    Number((value >> BigInt(40 - 8 * index)) & 0xffn)
      .toString(16)
      .padStart(2, "0"),
  ).join("");
}

function randomTail(): string {
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

/** A fresh, gate-shaped session id.
 *
 *  Pass a `seed` to make the id stable for that caller: the id is then derived
 *  from the seed plus the current time, so repeated calls from one caller share
 *  a memory window while different callers stay independent. Without a seed the
 *  id is unique per call. */
export function newSessionId(seed?: string): string {
  const epoch = Date.now();
  if (!seed) return `ses_${encodeTimestamp(epoch)}${randomTail()}`;
  // FNV-1a over the seed, then mixed with the epoch so the id is stable per
  // seed within a request but never a constant an upstream can fingerprint.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  h = (h ^ (epoch & 0xffffffff)) >>> 0;
  const tail = Array.from({ length: 14 }, (_, index) => {
    const v = (h >>> ((index % 4) * 8)) ^ (index * 0x9e3779b9);
    return ID_CHARS[(v >>> 0) % ID_CHARS.length];
  }).join("");
  return `ses_${encodeTimestamp(epoch)}${tail}`;
}

/** Recover the creation time from a gate-shaped id.
 *
 *  The scheme stores six bytes, so only the low 48 bits of
 *  `~(timestamp * 0x1000 + counter)` survive. The timestamp is therefore
 *  recoverable only modulo 2^36 ms (~2.18 years), which is all the identifier
 *  scheme ever promised: it orders ids and gives a plausible creation time, it
 *  is not a clock. Returns the congruent value. */
export const TIMESTAMP_WINDOW_MS = 0x1000000000; // 2^36

export function decodeTimestamp(id: string): number | null {
  const hex = id.startsWith("ses_") ? id.slice(4, 16) : id.slice(0, 12);
  if (!/^[0-9a-f]{12}$/.test(hex)) return null;
  const mask = 0x1000000000000n; // 2^48
  const signed = BigInt(`0x${hex}`);
  const current = (((-signed - 1n) % mask) + mask) % mask;
  return Number(current / 0x1000n);
}

/** The same time, expressed as the shortest distance from `now` within the
 *  encoding's repeat window. Small means "created recently". */
export function timestampAgeMs(id: string, now = Date.now()): number | null {
  const t = decodeTimestamp(id);
  if (t === null) return null;
  const delta = ((now - t) % TIMESTAMP_WINDOW_MS + TIMESTAMP_WINDOW_MS) % TIMESTAMP_WINDOW_MS;
  return Math.min(delta, TIMESTAMP_WINDOW_MS - delta);
}

/** True when an id has the shape the gate accepts. Used by tests and by the
 *  diagnostic endpoint so a malformed id is caught before it reaches upstream. */
export function isGateShapedSessionId(id: string): boolean {
  return /^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/.test(id);
}
