import { formatTimeAgo } from "@vyoh/shared";
import { useEffect, useState } from "react";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// How long until `formatTimeAgo` would return something different. Its units
// coarsen as the gap grows, so a day-old timestamp needs one wake-up a day,
// not one a minute — the same "step at the moment it changes, never twice for
// the same value" scheduling as `steam/sessions/use-elapsed-minutes.ts`.
function msUntilNextChange(elapsedMs: number): number {
  if (elapsedMs < HOUR_MS) return MINUTE_MS - (elapsedMs % MINUTE_MS);
  if (elapsedMs < DAY_MS) return HOUR_MS - (elapsedMs % HOUR_MS);
  return DAY_MS - (elapsedMs % DAY_MS);
}

/**
 * An elapsed-time string that stays true while the page is open.
 *
 * `formatTimeAgo` reads the clock once per render, so a surface whose data has
 * stopped arriving keeps showing whatever it computed when it mounted. A Steam
 * profile left open overnight read "checked just now" beside a thirteen-hour-old
 * poll — worse than merely stale, because it asserts a freshness nothing
 * supports. Owning the clock makes elapsed time an input this re-renders on.
 *
 * A component rather than a hook called in each parent, because React re-renders
 * whoever holds the state: a step costs one text node instead of a hero carrying
 * pointer springs and a Ken-Burns backdrop.
 *
 * The visibility listener is not redundant with the timer. A backgrounded tab
 * has its timers throttled and a sleeping machine stops firing them altogether,
 * so the wake-up that should have stepped the string never ran — which is the
 * exact shape of the overnight report. Re-reading the clock on the way back in
 * corrects it before the viewer can look.
 */
export function RelativeTime({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const since = new Date(iso).getTime();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      // Clamped because a timestamp can sit slightly in the future when the
      // browser clock trails the server's; a negative remainder would schedule
      // the next wake-up in the past and spin.
      timer = setTimeout(tick, msUntilNextChange(Math.max(0, at - since)));
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      tick();
    };

    timer = setTimeout(tick, msUntilNextChange(Math.max(0, Date.now() - since)));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [iso]);

  return <>{formatTimeAgo(iso, now)}</>;
}
