import { newSessionId } from "./session-identity.server";

/** Per-request egress lanes.
 *
 *  Every inbound request is served by its own lane: its own session fingerprint,
 *  its own rotation cursor, its own upstream attempt budget. Nothing is shared
 *  between lanes, so one caller's rate limit, ban, or slow model cannot stall
 *  another caller's request.
 *
 *  The lane count is the only shared resource, and it is bounded on purpose. An
 *  unbounded fan-out would open one socket per inbound request until the process
 *  runs out of file descriptors, at which point *every* lane fails together —
 *  the exact outcome lanes exist to prevent. Instead a lane that cannot be
 *  admitted immediately waits in a bounded queue, and a lane that waits past the
 *  deadline is shed with a 503 telling the caller to retry. Shedding is the
 *  honest answer under overload: it is fast, it is per-caller, and it keeps the
 *  lanes already running healthy.
 */

export type LaneState = "active" | "queued" | "closed";

/** Which capacity tier served a lane.
 *
 *  `primary` is the ZYRAXON lane budget — the number of upstream conversations
 *  this process holds on its own account. `spill` is the overflow tier: once
 *  every primary lane is busy, further callers are handed to the OpenCode Zen
 *  free pool rather than refused, so a burst is *transferred* instead of
 *  dropped. The spill tier is bounded too, so "transfer the load" can never
 *  become "open a socket per caller until the process dies". */
export type LaneTier = "primary" | "spill";

export type Lane = {
  /** Unique per inbound request. Safe to log; carries no caller data. */
  readonly id: string;
  /** Fingerprint sent upstream. Unique per lane unless a seed is supplied. */
  readonly sessionId: string;
  readonly startedAt: number;
  /** How many upstream models this lane may try before giving up. */
  attemptsLeft: number;
  /** Which capacity tier admitted this lane. */
  readonly tier: LaneTier;
  state: LaneState;
};

export type LanePoolOptions = {
  /** Maximum lanes doing upstream work at once, on this process's own budget. */
  maxActive: number;
  /** Extra lanes that may be handed to the OpenCode Zen free pool once every
   *  primary lane is busy. This is the overflow tier: it exists so an overload
   *  is *transferred* rather than shed, and it is bounded so the process still
   *  cannot be made to open an unbounded number of sockets. */
  spillMax: number;
  /** Maximum lanes waiting for a slot. Beyond this, requests are shed. */
  maxQueued: number;
  /** How long a lane may wait for a slot before it is shed. */
  queueTimeoutMs: number;
  /** How long admitted work may run before it is abandoned. An upstream that
   *  accepts a connection and then goes silent would otherwise hold its slot
   *  forever; with `maxActive` slots in total, a few stuck upstreams would
   *  starve every other caller. The deadline is the backstop that guarantees a
   *  lane is always eventually returned. */
  maxWorkMs: number;
  /** The same backstop for a turn that carries media. A model handed audio or
   *  video can spend minutes reasoning about it before its first visible token,
   *  and the answer is only useful once it arrives — cutting the stream at the
   *  text ceiling would return an empty answer for work that was nearly done.
   *  Still a backstop, not a budget: it bounds a wedged socket, nothing else. */
  mediaWorkMs: number;
};

export const DEFAULT_LANE_OPTIONS: LanePoolOptions = {
  // Sized for one Node process talking to a third-party free tier. Raising this
  // is a capacity decision, not a tuning knob: the upstream throttles per
  // fingerprint and per IP, so more lanes in flight mostly buy more 429s.
  maxActive: 512,
  // The overflow tier. Small on purpose: spill lanes exist to absorb a *burst*
  // by handing it to the OpenCode Zen free pool, not to become a second,
  // unbounded pool. Beyond primary + spill the honest answer is shedding.
  spillMax: 256,
  maxQueued: 4096,
  queueTimeoutMs: 15_000,
  // Generous enough for a long streamed answer, short enough that a wedged
  // connection cannot permanently consume a slot.
  maxWorkMs: 180_000,
  // A media turn is a different shape of work: the model has to take in the
  // bytes before it can say anything, and the strongest free models do that by
  // reasoning for a minute or more. The window is therefore measured in
  // minutes, but it is still finite, so a stalled socket still returns its slot.
  mediaWorkMs: 600_000,
};

export type LaneStats = {
  active: number;
  /** Lanes currently served by the overflow tier (OpenCode Zen hand-off). */
  spill: number;
  queued: number;
  opened: number;
  shed: number;
  /** Lanes admitted on the spill tier over this process's lifetime. */
  spilled: number;
  /** Lanes abandoned because their upstream ran past the work deadline. Counted
   *  here, not in `failed`, so the two buckets never overlap. */
  timedOut: number;
  completed: number;
  /** Lanes that ended in an error other than a timeout. */
  failed: number;
  peakActive: number;
  peakSpill: number;
};

export class LanePool {
  private readonly opts: LanePoolOptions;

  /** The media backstop, so a caller that knows its turn carries media can ask
   *  for the longer window without reaching into the pool's configuration. */
  get mediaWorkMs(): number {
    return this.opts.mediaWorkMs;
  }
  private active = 0;
  private spillActive = 0;
  private waiting: Array<{ resolve: () => void; reject: (e: Error) => void; timer: any }> = [];
  private counters = {
    opened: 0,
    shed: 0,
    spilled: 0,
    completed: 0,
    failed: 0,
    timedOut: 0,
    peakActive: 0,
    peakSpill: 0,
  };

  constructor(opts: Partial<LanePoolOptions> = {}) {
    this.opts = { ...DEFAULT_LANE_OPTIONS, ...opts };
  }

  /** Admission control. Resolves with the tier that admitted this lane when it
   *  owns a slot, rejects with `LaneShedError` when the pool is saturated past
   *  its deadline.
   *
   *  Order is deliberate: the primary budget first, then the spill tier (which
   *  hands the turn to the OpenCode Zen free pool), then a bounded wait, then a
   *  shed. Overload is transferred before it is refused, and refused before it
   *  can grow without bound. */
  private acquire(): Promise<LaneTier> {
    if (this.active < this.opts.maxActive) {
      this.active++;
      if (this.active > this.counters.peakActive) this.counters.peakActive = this.active;
      return Promise.resolve("primary");
    }
    if (this.spillActive < this.opts.spillMax) {
      this.spillActive++;
      this.counters.spilled++;
      if (this.spillActive > this.counters.peakSpill) this.counters.peakSpill = this.spillActive;
      return Promise.resolve("spill");
    }
    if (this.waiting.length >= this.opts.maxQueued) {
      this.counters.shed++;
      return Promise.reject(new LaneShedError("pool saturated"));
    }
    return new Promise<LaneTier>((resolve, reject) => {
      const entry = {
        resolve: () => {
          clearTimeout(entry.timer);
          // Take whatever tier freed up: prefer a primary slot, fall back to
          // spill. A waiter is only here because both tiers were full, so at
          // least one has room by the time this runs.
          let tier: LaneTier;
          if (this.active < this.opts.maxActive) {
            this.active++;
            tier = "primary";
            if (this.active > this.counters.peakActive) this.counters.peakActive = this.active;
          } else {
            this.spillActive++;
            tier = "spill";
            this.counters.spilled++;
            if (this.spillActive > this.counters.peakSpill) this.counters.peakSpill = this.spillActive;
          }
          resolve(tier);
        },
        reject: (e: Error) => {
          clearTimeout(entry.timer);
          reject(e);
        },
        timer: null as any,
      };
      entry.timer = setTimeout(() => {
        const i = this.waiting.indexOf(entry);
        if (i >= 0) this.waiting.splice(i, 1);
        this.counters.shed++;
        reject(new LaneShedError("queue deadline exceeded"));
      }, this.opts.queueTimeoutMs);
      // Do not hold the event loop open for a queued lane.
      if (typeof entry.timer?.unref === "function") entry.timer.unref();
      this.waiting.push(entry);
    });
  }

  private release(tier: LaneTier): void {
    // Give the slot back first. If someone is waiting, hand it straight over:
    // the waiter's `resolve()` re-increments its own tier, so the net change is
    // zero and neither counter can drift above its ceiling.
    if (tier === "spill") this.spillActive--;
    else this.active--;
    const next = this.waiting.shift();
    if (next) next.resolve();
  }

  /** Run `work` in its own lane. The lane is always released, including on
   *  throw, so a crashed request cannot leak a slot.
   *
   *  A work deadline bounds how long an admitted lane may hold its slot. When
   *  it fires, the lane's result is abandoned and the slot is returned; the
   *  in-flight upstream call is left to settle on its own and its late result is
   *  ignored. Without this, an upstream that connects and then never answers
   *  would hold a slot for the life of the process, and a handful of those would
   *  take the whole pool down. */
  async run<T>(
    work: (lane: Lane) => Promise<T>,
    seed?: string,
    // Must be at least the quota re-ask count, because each re-ask spends one
    // of these; a lane of eight silently capped the twenty re-asks above it.
    attempts = Math.max(8, Number(process.env.ZYRAXON_LANE_ATTEMPTS || 24)),
    opts?: { workMs?: number },
  ): Promise<T> {
    const tier = await this.acquire();
    const lane: Lane = {
      id: laneId(),
      sessionId: newSessionId(seed),
      startedAt: Date.now(),
      attemptsLeft: attempts,
      tier,
      state: "active",
    };
    this.counters.opened++;
    const workMs = opts?.workMs ?? this.opts.maxWorkMs;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        this.counters.timedOut++;
        reject(new LaneShedError("lane work deadline exceeded"));
      }, workMs);
      if (typeof timer?.unref === "function") timer.unref();
    });
    try {
      // Race the work against its deadline. Whichever settles first decides the
      // caller's outcome; `finally` releases the slot exactly once either way.
      const out = await Promise.race([work(lane), deadline]);
      this.counters.completed++;
      return out;
    } catch (e) {
      // A timeout is already counted in `timedOut`; do not also count it as a
      // generic failure, or the two buckets would double-count the same lane.
      if (!timedOut) this.counters.failed++;
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
      lane.state = "closed";
      this.release(tier);
    }
  }

  /** Run a streaming handler in a lane, holding the slot until the response
   *  body is fully drained.
   *
   *  `run` releases as soon as the handler returns, which for a streaming turn
   *  is *before* the body has been read: the handler returns the Response the
   *  moment the first chunk proves the upstream is healthy. Releasing there
   *  would bound only how many streams are being *set up*, while an unbounded
   *  number of already-open streams stayed live — exactly the leak that matters
   *  at scale. Here the slot is held for the lifetime of the body, so
   *  `maxActive` is a true ceiling on concurrent upstream conversations.
   *
   *  The work deadline still applies: it now spans the whole stream, so a body
   *  that stalls mid-flight is abandoned and its slot returned. A non-Response
   *  result (an error response built by the caller) releases immediately. */
  async stream(
    work: (lane: Lane) => Promise<Response>,
    seed?: string,
    // Must be at least the quota re-ask count, because each re-ask spends one
    // of these; a lane of eight silently capped the twenty re-asks above it.
    attempts = Math.max(8, Number(process.env.ZYRAXON_LANE_ATTEMPTS || 24)),
    opts?: { workMs?: number },
  ): Promise<Response> {
    const tier = await this.acquire();
    const lane: Lane = {
      id: laneId(),
      sessionId: newSessionId(seed),
      startedAt: Date.now(),
      attemptsLeft: attempts,
      tier,
      state: "active",
    };
    this.counters.opened++;
    const workMs = opts?.workMs ?? this.opts.maxWorkMs;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      lane.state = "closed";
      this.release(tier);
    };

    let setupTimer: ReturnType<typeof setTimeout> | null = null;
    let streamTimer: ReturnType<typeof setTimeout> | null = null;
    const clearAll = () => {
      if (setupTimer) clearTimeout(setupTimer);
      if (streamTimer) clearTimeout(streamTimer);
      setupTimer = streamTimer = null;
    };
    const clearStream = () => {
      if (streamTimer) clearTimeout(streamTimer);
      streamTimer = null;
    };

    let res: Response;
    let setupTimedOut = false;
    try {
      res = await Promise.race([
        work(lane),
        new Promise<never>((_, reject) => {
          setupTimer = setTimeout(() => {
            setupTimedOut = true;
            this.counters.timedOut++;
            reject(new LaneShedError("lane work deadline exceeded"));
          }, workMs);
          if (typeof setupTimer?.unref === "function") setupTimer.unref();
        }),
      ]);
    } catch (e) {
      clearAll();
      if (!setupTimedOut) this.counters.failed++;
      release();
      throw e;
    }
    clearAll();

    if (!res.body) {
      this.counters.completed++;
      release();
      return res;
    }

    // Wrap the body so the slot is returned exactly once, whether the stream
    // finishes, is cancelled by the client, or errors.
    //
    // The deadline for this phase is an *idle* timeout, re-armed on every chunk,
    // not a total one: a long answer that keeps producing tokens is healthy and
    // must not be cut off, while a stream that goes silent mid-flight is stuck
    // and must give its slot back.
    const source = res.body.getReader();
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    const armStreamDeadline = () => {
      clearStream();
      streamTimer = setTimeout(() => {
        this.counters.timedOut++;
        source.cancel().catch(() => {});
        clearStream();
        controllerRef?.error(new LaneShedError("lane stream stalled"));
      }, workMs);
      if (typeof streamTimer?.unref === "function") streamTimer.unref();
    };
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controllerRef = controller;
        armStreamDeadline();
      },
      pull: async (controller) => {
        try {
          const { done, value } = await source.read();
          if (done) {
            clearStream();
            this.counters.completed++;
            release();
            controller.close();
            return;
          }
          if (value) controller.enqueue(value);
          armStreamDeadline();
        } catch (e) {
          clearStream();
          this.counters.failed++;
          release();
          controller.error(e);
        }
      },
      cancel: () => {
        clearStream();
        source.cancel().catch(() => {});
        release();
      },
    });
    return new Response(body, { status: res.status, headers: res.headers });
  }

  stats(): LaneStats {
    return {
      active: this.active,
      spill: this.spillActive,
      queued: this.waiting.length,
      opened: this.counters.opened,
      shed: this.counters.shed,
      spilled: this.counters.spilled,
      timedOut: this.counters.timedOut,
      completed: this.counters.completed,
      failed: this.counters.failed,
      peakActive: this.counters.peakActive,
      peakSpill: this.counters.peakSpill,
    };
  }

  /** The configured ceilings, as opposed to the live occupancy `stats()`
   *  reports. Fleet math needs the *ceiling*, not the current count. */
  capacity(): { maxActive: number; spillMax: number; maxQueued: number } {
    return {
      maxActive: this.opts.maxActive,
      spillMax: this.opts.spillMax,
      maxQueued: this.opts.maxQueued,
    };
  }
}

export class LaneShedError extends Error {
  readonly code = "lane_shed";
  constructor(reason: string) {
    super(`Request shed to protect in-flight lanes (${reason}). Retry shortly.`);
    this.name = "LaneShedError";
  }
}

let laneCounter = 0;
function laneId(): string {
  laneCounter = (laneCounter + 1) >>> 0;
  return `lane_${Date.now().toString(36)}_${laneCounter.toString(36)}`;
}

/** Read a positive integer from the environment, falling back when unset or
 *  malformed. Capacity must be tunable per deployment: one process behind a
 *  load balancer and one on a large host do not want the same lane count, and
 *  hard-coding it would force a code change to scale. */
function envInt(name: string, fallback: number): number {
  const raw = Number((process.env[name] || "").trim());
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/** The process-wide pool. One instance is correct: the bound is a property of
 *  the process, not of a caller. Operators raise the ceiling with
 *  ZYRAXON_MAX_LANES / ZYRAXON_SPILL_LANES / ZYRAXON_MAX_QUEUED /
 *  ZYRAXON_QUEUE_TIMEOUT_MS / ZYRAXON_MAX_WORK_MS without touching code. */
export const lanePool = new LanePool({
  maxActive: envInt("ZYRAXON_MAX_LANES", DEFAULT_LANE_OPTIONS.maxActive),
  spillMax: envInt("ZYRAXON_SPILL_LANES", DEFAULT_LANE_OPTIONS.spillMax),
  maxQueued: envInt("ZYRAXON_MAX_QUEUED", DEFAULT_LANE_OPTIONS.maxQueued),
  queueTimeoutMs: envInt("ZYRAXON_QUEUE_TIMEOUT_MS", DEFAULT_LANE_OPTIONS.queueTimeoutMs),
  maxWorkMs: envInt("ZYRAXON_MAX_WORK_MS", DEFAULT_LANE_OPTIONS.maxWorkMs),
});
