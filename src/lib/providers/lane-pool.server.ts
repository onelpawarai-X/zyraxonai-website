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

export type Lane = {
  /** Unique per inbound request. Safe to log; carries no caller data. */
  readonly id: string;
  /** Fingerprint sent upstream. Unique per lane unless a seed is supplied. */
  readonly sessionId: string;
  readonly startedAt: number;
  /** How many upstream models this lane may try before giving up. */
  attemptsLeft: number;
  state: LaneState;
};

export type LanePoolOptions = {
  /** Maximum lanes doing upstream work at once. */
  maxActive: number;
  /** Maximum lanes waiting for a slot. Beyond this, requests are shed. */
  maxQueued: number;
  /** How long a lane may wait for a slot before it is shed. */
  queueTimeoutMs: number;
};

export const DEFAULT_LANE_OPTIONS: LanePoolOptions = {
  // Sized for one Node process talking to a third-party free tier. Raising this
  // is a capacity decision, not a tuning knob: the upstream throttles per
  // fingerprint and per IP, so more lanes in flight mostly buy more 429s.
  maxActive: 512,
  maxQueued: 4096,
  queueTimeoutMs: 15_000,
};

export type LaneStats = {
  active: number;
  queued: number;
  opened: number;
  shed: number;
  completed: number;
  failed: number;
  peakActive: number;
};

export class LanePool {
  private readonly opts: LanePoolOptions;
  private active = 0;
  private waiting: Array<{ resolve: () => void; reject: (e: Error) => void; timer: any }> = [];
  private counters = { opened: 0, shed: 0, completed: 0, failed: 0, peakActive: 0 };

  constructor(opts: Partial<LanePoolOptions> = {}) {
    this.opts = { ...DEFAULT_LANE_OPTIONS, ...opts };
  }

  /** Admission control. Resolves when this lane owns a slot, rejects with
   *  `LaneShedError` when the pool is saturated past its deadline. */
  private acquire(): Promise<void> {
    if (this.active < this.opts.maxActive) {
      this.active++;
      if (this.active > this.counters.peakActive) this.counters.peakActive = this.active;
      return Promise.resolve();
    }
    if (this.waiting.length >= this.opts.maxQueued) {
      this.counters.shed++;
      return Promise.reject(new LaneShedError("pool saturated"));
    }
    return new Promise<void>((resolve, reject) => {
      const entry = {
        resolve: () => {
          clearTimeout(entry.timer);
          this.active++;
          if (this.active > this.counters.peakActive) this.counters.peakActive = this.active;
          resolve();
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

  private release(): void {
    // Give the slot back first. If someone is waiting, hand it straight over:
    // `resolve()` re-increments, so the net change is zero and `active` can
    // never drift above `maxActive`.
    this.active--;
    const next = this.waiting.shift();
    if (next) next.resolve();
  }

  /** Run `work` in its own lane. The lane is always released, including on
   *  throw, so a crashed request cannot leak a slot. */
  async run<T>(work: (lane: Lane) => Promise<T>, seed?: string, attempts = 8): Promise<T> {
    await this.acquire();
    const lane: Lane = {
      id: laneId(),
      sessionId: newSessionId(seed),
      startedAt: Date.now(),
      attemptsLeft: attempts,
      state: "active",
    };
    this.counters.opened++;
    try {
      const out = await work(lane);
      this.counters.completed++;
      return out;
    } catch (e) {
      this.counters.failed++;
      throw e;
    } finally {
      lane.state = "closed";
      this.release();
    }
  }

  stats(): LaneStats {
    return {
      active: this.active,
      queued: this.waiting.length,
      opened: this.counters.opened,
      shed: this.counters.shed,
      completed: this.counters.completed,
      failed: this.counters.failed,
      peakActive: this.counters.peakActive,
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

/** The process-wide pool. One instance is correct: the bound is a property of
 *  the process, not of a caller. */
export const lanePool = new LanePool();
