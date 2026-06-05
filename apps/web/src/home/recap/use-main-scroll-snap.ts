import { useEffect } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

/**
 * Sets `scroll-snap-type: y proximity` on `<main>` while at least one consumer
 * has claimed the snap mode, restores the prior value when the last consumer
 * unmounts. Module-level ref count so multiple `<ChapterMultiBeat>` instances
 * on the same page (one per recap subject) co-exist cleanly.
 *
 * Why `proximity` and not `mandatory`: per [__root.tsx](../../routes/__root.tsx)
 * § "No `scroll-snap-type` here", the prior architecture removed mandatory snap
 * because it "fought the mouse wheel" and produced mid-snap dead zones.
 * Proximity only snaps when the user releases the scroll near a snap point —
 * doesn't interrupt active scrolling, doesn't trap mid-snap, but does close
 * the "user lifted off between two beats" gap that `scroll-snap-stop: always`
 * alone (the prior state) couldn't enforce because it required snap-type to
 * be set on the scroll container.
 *
 * The `scroll-snap-align: start` + `scroll-snap-stop: always` classes on each
 * `<MultiBeat>` are inert without this hook claiming snap-type. Without this
 * hook, beat snap is silently no-op cross-browser (Firefox surfaced this
 * first because its native scroll inertia is more linear than Chromium's;
 * Chromium's smooth scroll + spring deceleration disguised the missing snap
 * as "the wheel is snappy enough on its own").
 */
const SNAP_VALUE = "y proximity" as const;
let activeClaims = 0;
let originalSnapType: string | null = null;

export function useMainScrollSnapClaim(): void {
  useEffect(() => {
    const main = mainScrollRef.current;
    if (!main) return;
    if (activeClaims === 0) {
      originalSnapType = main.style.scrollSnapType;
      main.style.scrollSnapType = SNAP_VALUE;
    }
    activeClaims += 1;
    return () => {
      activeClaims -= 1;
      if (activeClaims === 0) {
        const restoreMain = mainScrollRef.current;
        if (restoreMain) restoreMain.style.scrollSnapType = originalSnapType ?? "";
        originalSnapType = null;
      }
    };
  }, []);
}

// Exported for tests — resets module state between cases.
export function __resetMainScrollSnapClaim(): void {
  activeClaims = 0;
  originalSnapType = null;
}
