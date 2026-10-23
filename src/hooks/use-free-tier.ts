import { useEffect, useRef, useState } from "react";
import type { FreeTierStatus } from "@/components/site/FreeTierCountdown";

/** The shared free-tier state, polled from the provider endpoint.
 *
 *  The reset clock is not a client-side guess: the upstream states it in
 *  `retry-after`, the provider endpoint records it, and this hook reads it
 *  back. Two rules keep the picture honest:
 *
 *  - Poll slowly while the window is open, quickly while it is closing. A
 *    spent pool is worth watching (it may open any second); an open one is not.
 *  - Keep the last known value across a failed poll. A network blip must not
 *    blank the countdown and leave a reader with no answer.
 *
 *  `status.available` is the server's truth, so a stale timestamp cannot leave
 *  the page claiming the pool is closed after it has opened. */
export function useFreeTier(): { freeTier?: FreeTierStatus; checked: boolean } {
  const [freeTier, setFreeTier] = useState<FreeTierStatus | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const r = await fetch("/api/public/zyraxon/v1/provider");
        if (r.ok) {
          const d = await r.json();
          if (alive && d?.freeTier) setFreeTier(d.freeTier as FreeTierStatus);
        }
      } catch {
        // Keep the last known value: a failed poll is not evidence the pool
        // opened, and blanking the panel would be a worse answer than a
        // slightly stale one.
      } finally {
        if (alive) {
          setChecked(true);
          // Closed: check often, because it opens on the upstream's clock, not
          // ours. Open: check rarely, because nothing is changing.
          const delay = freeTierRef.current?.available === false ? 15_000 : 60_000;
          timer.current = window.setTimeout(poll, delay);
        }
      }
    };

    poll();
    return () => {
      alive = false;
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // The poll loop reads the latest value without being restarted by it.
  const freeTierRef = useRef<FreeTierStatus | undefined>(undefined);
  useEffect(() => {
    freeTierRef.current = freeTier;
  }, [freeTier]);

  return { freeTier, checked };
}
