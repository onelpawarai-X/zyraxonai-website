/** An end-to-end record of what actually left this deployment for the upstream.
 *
 *  When the free tier refuses a turn the caller sees one sentence — "temporarily
 *  out of free capacity" — and everything that would explain it is gone: which
 *  address the request left by, which identity headers it carried, what the
 *  upstream's own error type was, and what the rotation decided to do next. The
 *  two refusals that matter are easy to confuse from the outside and need
 *  opposite responses:
 *
 *    403 FreeTierError        the request did not look like an OpenCode client
 *    429 FreeUsageLimitError  the request looked right and the window is spent
 *
 *  The first is a fault on our side and re-asking cannot fix it; the second is
 *  momentary and re-asking is the whole recovery. Telling them apart from a
 *  status code alone is guesswork, so the raw type and message are kept here.
 *
 *  This is a diagnostic, not a log: a bounded ring in the isolate's memory, so
 *  it costs no storage and never grows. It is deliberately in-memory only —
 *  it is read by the operator looking at the provider page right after a
 *  failure, not kept for history.
 *
 *  Nothing secret is recorded. The API key and the `Authorization` header are
 *  never captured; the headers are recorded by *name* so a missing identity
 *  header is visible without any value being exposed. */
import { egressStatus, resolveEgressIp } from "./egress.server";

export type TraceOutcome = "served" | "refused" | "gated" | "upgrade" | "fault";

export type TraceEntry = {
  /** Monotonic, so a reader can order entries without trusting clocks. */
  seq: number;
  at: string;
  /** Which call in the turn this was, 1-based. Set by the rotation, which is
   *  the only place that knows the count; the transport just records the send. */
  attempt?: number;
  /** The ZYRAXON brand the caller asked for, and the upstream model tried. */
  model?: string;
  upstream?: string;
  /** The exact URL the request was sent to. */
  url?: string;
  method?: string;
  /** Where it left from: `direct`, or the gateway/proxy URL it was posted
   *  through. This is the closest thing to "which IP did this leave by" that
   *  the deployment itself can know — the address a gateway uses is the
   *  gateway's, and is named here so it can be checked against the gateway's
   *  own report. */
  egress?: string;
  /** The address the gateway actually left from, resolved from the gateway
   *  itself. Absent in direct mode, where the deployment's own address is the
   *  one the upstream saw and is not something it can read from the outside. */
  egressIp?: string;
  egressColo?: string;
  egressMode?: string;
  /** The identity headers that were set, by name only. The gate reads these, so
   *  a refusal with them missing is a different fault from a spent window. */
  identityHeaders?: string[];
  /** The session fingerprint carried, which is what the gate keys on. */
  session?: string;
  /** The body, reduced to what identifies it rather than what it said: a
   *  request that never carried the user's message is a different fault from
   *  one the upstream refused. */
  request?: { model?: string; messages?: number; stream?: boolean; bytes?: number };
  /** What came back. */
  status?: number;
  /** The upstream's own error type — `FreeTierError`, `FreeUsageLimitError` —
   *  which is the field that separates a gate from a spent window. */
  errorType?: string;
  /** The upstream's own words, truncated. */
  message?: string;
  retryAfterSeconds?: number;
  outcome?: TraceOutcome;
  /** What the rotation did about it, and why. */
  decision?: string;
  /** Which predicate classified it, so a misclassification is visible. */
  classifiedAs?: string;
};

/** Bounded so a long-lived isolate cannot accumulate without limit. Large
 *  enough to hold a whole turn's attempts across a rotation, small enough that
 *  the payload stays readable. */
const MAX = Math.max(8, Number(process.env.ZYRAXON_TRACE_MAX || 40));

let seq = 0;
const ring: TraceEntry[] = [];

/** Record one upstream exchange. Returns the entry so a caller can amend it
 *  once the outcome is known (the retry loop decides after the fact). */
export function traceUpstream(entry: Omit<TraceEntry, "seq" | "at">): TraceEntry {
  const full: TraceEntry = { seq: ++seq, at: new Date().toISOString(), ...entry };
  ring.push(full);
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
  return full;
}

/** Pull the upstream's own error type out of a response body.
 *
 *  Both refusals are JSON with a `type` beside the message, and that field is
 *  the only reliable difference between them — the status alone is not enough,
 *  because a gate and a limit have been seen under both. */
export function errorTypeOf(text: string): string | undefined {
  // Every match, not just the first: the envelope is `{"type":"error","error":
  // {"type":"FreeTierError",...}}`, so the first `type` is the useless outer
  // `error` and the one that identifies the refusal is inside it.
  const all = text.match(/"type"\s*:\s*"([A-Za-z0-9_.-]+)"/g) || [];
  for (const raw of all) {
    const value = raw.match(/"([A-Za-z0-9_.-]+)"$/)?.[1];
    if (value && value !== "error") return value;
  }
  return undefined;
}

/** A one-line summary of the egress state at the moment of the call, so an
 *  entry explains where the request went without a second lookup. */
export function traceEgress(): { egress?: string; mode: string } {
  const s = egressStatus();
  return { mode: s.mode };
}

/** Fill in where a recorded exchange actually left from.
 *
 *  Called after the fact, because resolving the gateway's address is itself a
 *  request and must never delay the turn it is describing. Only refusals are
 *  worth the lookup: a served turn's address is not in question. */
export function traceEgressAddress(entry: TraceEntry, proxy: string | undefined): void {
  if (!proxy) return;
  void resolveEgressIp(proxy).then((r) => {
    if (!r) return;
    entry.egressIp = r.ip;
    entry.egressColo = r.colo;
  });
}

/** Amend the newest entry that has no decision yet.
 *
 *  The transport records the send; the rotation decides what to do about the
 *  answer, one step later and in another module. This is how the two halves
 *  meet without the transport having to know the rotation's policy. */
export function amendLastTrace(decision: string, classifiedAs?: string): void {
  for (let i = ring.length - 1; i >= 0; i--) {
    if (!ring[i].decision) {
      ring[i].decision = decision;
      if (classifiedAs) ring[i].classifiedAs = classifiedAs;
      return;
    }
  }
}

/** A compact summary for a surface: what the last few refusals actually were.
 *
 *  The point is to make the gate/limit distinction visible at a glance, because
 *  the two need opposite responses and the status code alone does not tell them
 *  apart. */
export function refusalSummary(): {
  total: number;
  gated: number;
  limited: number;
  served: number;
  /** Turns the upstream refused because the reported client release is below
   *  its floor. Its own bucket, because the fix is the version pin and not a
   *  key, a retry, or another model. */
  upgrade: number;
  lastErrorType?: string;
  lastMessage?: string;
  lastAt?: string;
} {
  let gated = 0;
  let limited = 0;
  let served = 0;
  let upgrade = 0;
  for (const e of ring) {
    if (e.outcome === "served") served++;
    else if (e.outcome === "gated") gated++;
    else if (e.outcome === "upgrade") upgrade++;
    else if (e.outcome === "refused") limited++;
  }
  const lastRefusal = [...ring].reverse().find((e) => e.outcome !== "served");
  return {
    total: ring.length,
    gated,
    limited,
    served,
    upgrade,
    lastErrorType: lastRefusal?.errorType,
    lastMessage: lastRefusal?.message,
    lastAt: lastRefusal?.at,
  };
}

/** The recorded exchanges, newest last. */
export function upstreamTrace(): TraceEntry[] {
  return ring.slice();
}

/** Test seam. */
export function resetUpstreamTrace(): void {
  ring.length = 0;
  seq = 0;
}
