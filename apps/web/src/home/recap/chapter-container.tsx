import { useReducedMotion } from "motion/react";
import { type ReactNode, useRef } from "react";
import { ChapterProgressContext } from "./chapter-context";
import { useChapterProgress } from "./use-chapter-progress";

type Props = {
  /**
   * Pin-window length expressed in viewport heights. 1× yields no real pin
   * (the sticky child fills its container exactly); ≥1.5× yields an Apple-
   * style scrubbable window. Recap subject chapters target ~1.5–2×.
   */
  pinViewports?: number;
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /** Optional className applied to the sticky inner pin layer. */
  pinClassName?: string;
  children: ReactNode;
};

const DEFAULT_PIN_VIEWPORTS = 2;

/**
 * Sticky-pin wrapper for a recap chapter. The outer `<section>` is `pinViewports
 * × 100dvh` tall; its `position: sticky` child holds the viewport while the
 * chapter is in the pin window. Scroll progress through that window is
 * published via `ChapterProgressContext` for band primitives to consume.
 *
 * Under reduced motion the pin collapses — outer height drops to `auto`, the
 * inner layer stops being sticky, and content stacks vertically with normal
 * page flow. Bands still consume a frozen-at-0 progress MotionValue (their
 * reveal animations should themselves no-op under reduced motion).
 */
export function ChapterContainer({
  pinViewports = DEFAULT_PIN_VIEWPORTS,
  slug,
  ariaLabel,
  className,
  pinClassName,
  children,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const progress = useChapterProgress(ref);

  const outerStyle = reducedMotion
    ? undefined
    : { height: `calc(${pinViewports} * 100dvh)` };
  const outerClass = ["relative w-full", className].filter(Boolean).join(" ");
  const pinClass = reducedMotion
    ? ["flex w-full flex-col gap-6", pinClassName].filter(Boolean).join(" ")
    : ["sticky top-0 flex h-dvh w-full flex-col gap-6", pinClassName]
        .filter(Boolean)
        .join(" ");

  return (
    <ChapterProgressContext.Provider value={progress}>
      <section
        ref={ref}
        data-chapter={slug}
        data-pin={reducedMotion ? "off" : "on"}
        aria-label={ariaLabel}
        className={outerClass}
        style={outerStyle}
      >
        <div data-chapter-pin className={pinClass}>
          {children}
        </div>
      </section>
    </ChapterProgressContext.Provider>
  );
}
