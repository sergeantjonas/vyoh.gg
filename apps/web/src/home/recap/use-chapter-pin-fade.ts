import { mainScrollRef } from "@/lib/scroll-container";
import { type MotionValue, useMotionValue } from "motion/react";
import { type RefObject, useEffect } from "react";

/**
 * Tracks a chapter's "pin proximity" as a 0..1 MotionValue:
 *
 *   - 0 while the chapter is well below the viewport top (pre-pin approach).
 *   - Ramps 0 → 1 as the chapter outer's top edge crosses the ramp window
 *     immediately above pin start (the last `rampPx` of approach scroll).
 *   - Stays at 1 throughout the pin window and after the chapter unpins.
 *
 * Drives band-scrim opacity so chapter chrome (dark cards, borders,
 * backdrop blur) is invisible while the user is still on the hero and only
 * fades in as the chapter actually approaches. Without this, the chapter's
 * sticky child renders at its natural-flow position (the top of the 200vh
 * outer), which puts the opener band's scrim card peeking into the bottom
 * of the hero viewport before pin starts.
 *
 * Separate from `useChapterProgress` (0..1 across the pin window). Progress
 * can't distinguish "approaching pin" from "at pin start" — both are 0 —
 * so the fade signal needs its own listener keyed on raw `rect.top`.
 */
const DEFAULT_RAMP_PX = 120;

export function useChapterPinFade(
  ref: RefObject<HTMLElement | null>,
  rampPx: number = DEFAULT_RAMP_PX
): MotionValue<number> {
  const fade = useMotionValue(0);

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) {
        fade.set(0);
        return;
      }
      const container = mainScrollRef.current;
      const containerTop = container?.getBoundingClientRect().top ?? 0;
      const rect = el.getBoundingClientRect();
      const rectTop = rect.top - containerTop;

      if (rectTop >= rampPx) {
        fade.set(0);
      } else if (rectTop <= 0) {
        fade.set(1);
      } else {
        // Linear ramp across the rampPx window — 1 at pin start, 0 at the
        // top edge of the window.
        fade.set(1 - rectTop / rampPx);
      }
    };
    apply();
    const c = mainScrollRef.current ?? window;
    c.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply, { passive: true });
    return () => {
      c.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, [ref, fade, rampPx]);

  return fade;
}
