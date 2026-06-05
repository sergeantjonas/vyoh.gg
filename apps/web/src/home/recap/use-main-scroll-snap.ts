import { useEffect } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

/**
 * Sets `scroll-snap-type: y proximity` on `<main>` while at least one consumer
 * has claimed the snap mode, restores the prior value when the last consumer
 * unmounts. Module-level ref count so multiple `<ChapterMultiBeat>` instances
 * on the same page (one per recap subject) co-exist cleanly.
 *
 * `mandatory` rather than `proximity` because proximity left Firefox
 * "vibrating" between candidate snap targets as the user scrolled (the
 * algorithm couldn't decide which of two nearby points to favor and
 * kept retargeting per scroll event). The prior arc's "snap fought the
 * mouse wheel" complaint was about chapter-level mandatory snap on a
 * different architecture; per-beat mandatory inside a sticky-headered
 * chapter is decisive without being trappy because the snap points are
 * spaced exactly one beat apart with no nearby ambiguity.
 *
 * The `scroll-snap-align: start` + `scroll-snap-stop: always` classes on
 * each `<MultiBeat>` are inert without this hook claiming snap-type.
 */
const SNAP_VALUE = "y mandatory" as const;
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
