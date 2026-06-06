import { useMotionValueEvent } from "motion/react";
import { type RefObject, useContext, useMemo, useState } from "react";

import type { AtmosphereClaim } from "@/home/atmosphere/use-atmosphere-claim";

import { useAssetClaim } from "./use-asset-claim";
import { ChapterMultiBeatContext } from "./use-beat-progress";

/**
 * Per-beat atmosphere claim publisher for multi-beat aggregator chapters.
 *
 * The atmosphere layer's intersection-based proximity weighting can't
 * distinguish "which beat is focal" inside one ChapterMultiBeat: every
 * beat element lives at the same vertical position inside the sticky
 * stage, so every beat's bounding rect overlaps the viewport identically.
 * The chapter's scrollYProgress is the only signal that tracks which
 * beat is focal.
 *
 * This component subscribes to scrollYProgress, computes a focal-beat
 * index from `round(progress * (beatCount - 1))` (so the swap happens
 * at the midpoint of each transition window), and re-publishes the
 * corresponding entry from `claims` as the chapter's single atmosphere
 * claim. The atmosphere layer's two-layer image stack handles the
 * crossfade between focal beats — same code path that handles Ahri's
 * skin rotation, so the transition reads as a deliberate splash swap
 * rather than a chrome glitch.
 *
 * Must be rendered AS A CHILD of `<ChapterMultiBeat>` so it can read the
 * `ChapterMultiBeatContext` published by the chapter. Returns `null`
 * (no DOM); side-effect only.
 *
 * The `outerRef` argument is the proximity element the atmosphere layer
 * uses for intersection weighting against other claims (Ahri, conclusion,
 * other chapters). Pass the aggregator's `outerRef` so the atmosphere
 * picks up the aggregator's vertical position the same way the standalone
 * AhriChapter / SteamChapter wrappers do.
 */
export function FocalBeatAtmosphereClaim({
  outerRef,
  claims,
}: {
  outerRef: RefObject<HTMLElement | null>;
  /** One claim per beat, in beat order. The focal beat's entry is
   *  published; non-focal entries are inert until selected. */
  claims: readonly AtmosphereClaim[];
}) {
  const ctx = useContext(ChapterMultiBeatContext);
  // Context never disappears mid-life (provider mounts and stays), but
  // it's null outside a `<ChapterMultiBeat>`; throw early so a caller
  // misplacing the component gets a clear error rather than a silent
  // claim that never updates.
  if (!ctx) {
    throw new Error(
      "FocalBeatAtmosphereClaim must be rendered inside <ChapterMultiBeat>"
    );
  }
  return (
    <FocalBeatAtmosphereClaimInner
      outerRef={outerRef}
      claims={claims}
      scrollYProgress={ctx.scrollYProgress}
    />
  );
}

function FocalBeatAtmosphereClaimInner({
  outerRef,
  claims,
  scrollYProgress,
}: {
  outerRef: RefObject<HTMLElement | null>;
  claims: readonly AtmosphereClaim[];
  scrollYProgress: NonNullable<
    React.ContextType<typeof ChapterMultiBeatContext>
  >["scrollYProgress"];
}) {
  const [focalIndex, setFocalIndex] = useState(0);
  // Watch chapter progress and update the focal index when it crosses a
  // transition midpoint. `useMotionValueEvent` runs in a scroll-thread
  // callback so the setState here is gated on actual progress changes,
  // not every animation tick.
  useMotionValueEvent(scrollYProgress, "change", (latest: number) => {
    if (claims.length <= 1) return;
    const idx = Math.round(latest * (claims.length - 1));
    const clamped = Math.max(0, Math.min(claims.length - 1, idx));
    setFocalIndex((prev) => (prev === clamped ? prev : clamped));
  });
  const activeClaim = useMemo<AtmosphereClaim | null>(
    () => claims[focalIndex] ?? claims[0] ?? null,
    [claims, focalIndex]
  );
  // Defensive guard: render-time null claim never publishes (the hook
  // call still runs to keep render-order stable across re-renders).
  // Empty `claims` only happens on a malformed aggregator caller.
  useAssetClaim(outerRef, activeClaim ?? EMPTY_CLAIM);
  return null;
}

// Fallback claim that publishes nothing visible — image undefined, the
// atmosphere layer falls back to its background. Only reached if the
// caller passes an empty `claims` array, which the aggregators gate on.
const EMPTY_CLAIM: AtmosphereClaim = {
  palette: { timeOfDay: "day", layers: [] },
  intensity: 0,
};
