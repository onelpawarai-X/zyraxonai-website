/** Horizontal capacity: turning one process's lane ceiling into a fleet ceiling.
 *
 *  The lane pool bounds the concurrent upstream conversations *one process* may
 *  hold. That bound is deliberately small (a few hundred), because past it the
 *  upstream's own per-fingerprint throttling dominates and more lanes in flight
 *  buy more 429s, not more answers. A bound of a few hundred per process cannot
 *  reach the scale we advertise on its own, so the honest unit of capacity is
 *  not "one process" but "N processes, each with its own ceiling".
 *
 *  This module is that multiplication, and nothing more. It assigns each request
 *  to a shard deterministically (from its session id, so one end user keeps
 *  landing on the same shard and the same memory window), and it reports the
 *  fleet size so an operator can see the ceiling they are actually running.
 *  It does NOT open sockets, spawn processes, or pretend a single box is a
 *  fleet: with one shard configured the ceiling is one process's ceiling, and
 *  `fleetStatus()` says so in plain words.
 *
 *  The number that matters is `ceiling = shards * maxActive`. That is the
 *  concurrent upstream conversations the deployment can hold before it starts
 *  shedding, and it is the number to size against the target.
 */

export type FleetStatus = {
  /** Number of independent lane-pool shards in this deployment. */
  shards: number;
  /** Concurrent lanes each shard admits on its own budget. */
  lanesPerShard: number;
  /** Overflow lanes each shard may spill to the OpenCode Zen free pool. */
  spillPerShard: number;
  /** shards * (lanesPerShard + spillPerShard): the fleet-wide concurrent-turn
   *  ceiling, including the overflow tier, before shedding begins. */
  ceiling: number;
  /** True when more than one shard is configured (a real fleet, not one box). */
  spread: boolean;
  note: string;
};

/** Parse a positive integer from the environment, with a floor of 1. */
function envInt(name: string, fallback: number): number {
  const raw = Number((process.env[name] || "").trim());
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** Stable 32-bit hash of a string. Same input, same shard, every time and on
 *  every process — a caller must not bounce between shards mid-conversation. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The shard a request belongs to. Derived from the caller's seed/session so a
 *  returning caller keeps their shard; a caller with no seed is spread by the
 *  random lane id the pool would have given them anyway. */
export function shardFor(key: string, shards: number): number {
  if (shards <= 1) return 0;
  return hash(key || "anon") % shards;
}

export function fleetStatus(
  shards: number,
  lanesPerShard: number,
  spillPerShard = 0,
): FleetStatus {
  const s = Math.max(1, shards);
  const lanes = Math.max(1, lanesPerShard);
  const spill = Math.max(0, spillPerShard);
  const ceiling = s * (lanes + spill);
  if (s <= 1) {
    return {
      shards: 1,
      lanesPerShard: lanes,
      spillPerShard: spill,
      ceiling,
      spread: false,
      note: `One process: ${lanes} primary lanes plus ${spill} overflow lanes handed to the OpenCode Zen free pool = ${ceiling} concurrent turns before shedding. To raise it, run more instances and set ZYRAXON_FLEET_SHARDS to match, or raise the per-process lane budget.`,
    };
  }
  return {
    shards: s,
    lanesPerShard: lanes,
    spillPerShard: spill,
    ceiling,
    spread: true,
    note: `${s} shards × (${lanes} primary + ${spill} overflow) = ${ceiling} concurrent turns fleet-wide. Requests are pinned to a shard by session id, so one caller never straddles two shards.`,
  };
}

/** Configured shard count. Default 1: a single process is the honest default,
 *  and claiming a fleet that is not deployed would misreport capacity. */
export const FLEET_SHARDS = envInt("ZYRAXON_FLEET_SHARDS", 1);
