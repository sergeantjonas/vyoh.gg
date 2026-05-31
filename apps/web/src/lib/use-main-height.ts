import { useLayoutEffect, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

// Returns the current visible height (clientHeight) of <main>, the app's actual
// scroll container. Re-measures via ResizeObserver, so resizing the window or
// toggling browser chrome (mobile address bar collapse, etc.) keeps the value
// current. Returns null until <main> has mounted.
//
// Use this when a route needs a section to fill main's visible viewport
// exactly. `min-h-dvh` overshoots by the sticky nav + ScrollProgress + the
// wrapping div's padding above main's content, and `min-h-[calc(100dvh-?rem)]`
// is a guess that leaks black strips when the chrome shifts (collapsing nav,
// mobile chrome reflow, font-size accessibility settings). Measurement is the
// only reliable path.
export function useMainHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const main = mainScrollRef.current;
    if (!main) return;
    const update = () => setHeight(main.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(main);
    return () => observer.disconnect();
  }, []);
  return height;
}
