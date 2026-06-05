import { useInView, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { ChapterBeatNudgeContext } from "./chapter-group";

/** Render-prop child: receives this beat's own nudge state. */
export type MultiBeatRenderProp = (nudged: boolean) => ReactNode;

type Props = {
  /** Beat index within its `<ChapterMultiBeat>` (0-based). Surfaces as `data-beat`. */
  index: number;
  /** Total beat count in the chapter — used for the `Beat N of M` aria label. */
  beatCount: number;
  /** Optional slug for selector targeting / debugging. */
  slug?: string;
  /** Optional ARIA label override; default is `Beat N of M`. */
  ariaLabel?: string;
  /** Layout className applied to the beat content wrapper. */
  className?: string;
  children: ReactNode | MultiBeatRenderProp;
};

/**
 * One beat in the horizontal-track multi-beat chapter (see
 * [`<ChapterMultiBeat>`](./chapter-multi-beat.tsx)). Renders a
 * viewport-wide, track-height wrapper that lives as one of N flex items
 * inside the parent's horizontal `motion.div` track.
 *
 * No own snap mechanics, no own enter/exit transform. The parent
 * translates the entire track horizontally as the chapter's vertical
 * scroll progresses; this beat just sits at its flex offset and becomes
 * the focal viewport when the track's `x` brings it under x=0.
 *
 * `useInView` against `mainScrollRef` drives the per-beat nudge so child
 * reveal cascades fire when this beat is the visible one. `amount: 0.5`
 * picks the dominant beat at any scroll position; beats either side of
 * the active one are not nudged, so their `<ChapterReveal>` cascades
 * don't fire prematurely.
 *
 * Under `prefers-reduced-motion`: collapses to a plain w-full block in
 * normal flow (the parent renders beats as a vertical stack), and nudge
 * fires immediately so reveals render without animation.
 */
export function MultiBeat({
  index,
  beatCount,
  slug,
  ariaLabel,
  className,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const isInView = useInView(ref, {
    root: mainScrollRef as React.RefObject<Element>,
    amount: 0.5,
  });

  const [nudged, setNudged] = useState(reducedMotion ?? false);
  useEffect(() => {
    if (reducedMotion) {
      setNudged(true);
      return;
    }
    setNudged(isInView);
  }, [isInView, reducedMotion]);

  const body = typeof children === "function" ? children(nudged) : children;
  const label = ariaLabel ?? `Beat ${index + 1} of ${beatCount}`;

  if (reducedMotion) {
    return (
      <ChapterBeatNudgeContext.Provider value={true}>
        <div
          ref={ref}
          // biome-ignore lint/a11y/useSemanticElements: carousel slide per W3C WAI-ARIA APG, not a form group
          role="group"
          aria-roledescription="slide"
          aria-label={label}
          data-beat={index}
          data-beat-slug={slug}
          className={["relative w-full", className].filter(Boolean).join(" ")}
        >
          {body}
        </div>
      </ChapterBeatNudgeContext.Provider>
    );
  }

  return (
    <ChapterBeatNudgeContext.Provider value={nudged}>
      <div
        ref={ref}
        // biome-ignore lint/a11y/useSemanticElements: carousel slide per W3C WAI-ARIA APG, not a form group
        role="group"
        aria-roledescription="slide"
        aria-label={label}
        data-beat={index}
        data-beat-slug={slug}
        className={["relative h-full w-screen shrink-0 overflow-hidden", className]
          .filter(Boolean)
          .join(" ")}
      >
        {body}
      </div>
    </ChapterBeatNudgeContext.Provider>
  );
}
