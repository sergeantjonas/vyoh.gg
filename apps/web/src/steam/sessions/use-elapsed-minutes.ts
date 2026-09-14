import { useEffect, useState } from "react";

const MINUTE_MS = 60 * 1000;

function minutesBetween(sinceIso: string | null, untilMs: number): number {
  if (sinceIso === null) return 0;
  return Math.max(0, Math.floor((untilMs - new Date(sinceIso).getTime()) / MINUTE_MS));
}

// Whole minutes since `sinceIso`, re-rendering on each minute boundary of the
// elapsed time rather than on a wall-clock interval, so the number steps at
// the moment it changes and never twice for the same value. Minutes, not
// seconds: the counter is a headline, and a headline that spins reads as a
// gauge.
//
// The first render counts to `asOfIso` rather than to the clock: the page is
// server-primed, and a server and a client reading their own clocks would
// disagree by up to a minute across hydration. The response's own timestamp
// is the same on both sides, so the document and the hydrating render agree,
// and the effect takes over from the real clock once mounted.
export function useElapsedMinutes(
  sinceIso: string | null,
  asOfIso: string | null
): number {
  const [minutes, setMinutes] = useState(() =>
    minutesBetween(sinceIso, asOfIso ? new Date(asOfIso).getTime() : Date.now())
  );

  useEffect(() => {
    if (sinceIso === null) return;
    const since = new Date(sinceIso).getTime();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const elapsed = Date.now() - since;
      setMinutes(minutesBetween(sinceIso, Date.now()));
      const untilNext = MINUTE_MS - (((elapsed % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);
      timer = setTimeout(tick, untilNext);
    };
    tick();
    return () => clearTimeout(timer);
  }, [sinceIso]);

  return sinceIso === null ? 0 : minutes;
}
