import { useReducedMotion } from "motion/react";
import { type ReactNode, useRef } from "react";

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
 * Sticky-pin wrapper for a recap chapter. The outer `<section>` is
 * `pinViewports × 100dvh` tall; its `position: sticky` child holds the
 * viewport while the chapter is in the pin window. Pure layout primitive —
 * reveal animations are owned by each band (via `ChapterReveal` /
 * `whileInView`), not by the container. Earlier the container also
 * published a chapter-scoped progress MotionValue, but a coordinated
 * progress signal forced reveals to play even when the band's element was
 * still off-screen. Per-band visibility-triggered reveals fix that by
 * construction.
 *
 * Under reduced motion the pin collapses — outer height drops to `auto`,
 * the inner layer stops being sticky, and content stacks vertically with
 * normal page flow.
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
  );
}
