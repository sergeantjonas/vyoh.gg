import { useEffect, useState } from "react";

const MINUTE_MS = 60 * 1000;

function minutesSince(sinceIso: string | null): number {
  if (sinceIso === null) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / MINUTE_MS));
}

// Whole minutes since `sinceIso`, re-rendering on each minute boundary of the
// elapsed time rather than on a wall-clock interval, so the number steps at
// the moment it changes and never twice for the same value. Minutes, not
// seconds: the counter is a headline, and a headline that spins reads as a
// gauge. The first render already reads the clock: this data is never
// server-rendered, so there is no hydration to keep in step with, and a
// "Just opened" flash before the effect ran would be a lie for one frame.
export function useElapsedMinutes(sinceIso: string | null): number {
  const [minutes, setMinutes] = useState(() => minutesSince(sinceIso));

  useEffect(() => {
    if (sinceIso === null) return;
    const since = new Date(sinceIso).getTime();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const elapsed = Date.now() - since;
      setMinutes(minutesSince(sinceIso));
      const untilNext = MINUTE_MS - (((elapsed % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);
      timer = setTimeout(tick, untilNext);
    };
    tick();
    return () => clearTimeout(timer);
  }, [sinceIso]);

  return sinceIso === null ? 0 : minutes;
}
