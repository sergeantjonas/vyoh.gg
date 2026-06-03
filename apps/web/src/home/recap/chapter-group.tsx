import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, type Ref, forwardRef, useEffect, useRef, useState } from "react";

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /**
   * Persistent chapter identity (logo, text mark, etc.) rendered sticky
   * at the top of the chapter group. Visible across beats 1+; hidden
   * over beat 0 (which typically owns its own editorial masthead). The
   * transition between hidden and visible is the chapter's "title
   * materialises" moment as the reader leaves the cover beat for the
   * body beats.
   *
   * Renders once at the group level rather than re-mounting inside every
   * beat — the identity is the chapter's constant under which the beat
   * content swaps, which lets per-beat content animations go bolder
   * without fighting an animated header.
   */
  identity?: ReactNode;
  children: ReactNode;
};

/**
 * Logical wrapper for a stacked-beat chapter (R-13 final architecture).
 * Each child `<ChapterBeat>` is its own viewport-tall, snap-aligned section
 * — beats traverse via native CSS scroll snap rather than via scroll
 * progress through a sticky pin. That eliminates the "release tail" of
 * sticky positioning (pin.height of unsnapped scroll after the last beat)
 * which kept making the last beat feel easy to scroll past in the prior
 * pin-based model.
 *
 * The `identity` slot, when present, renders sticky at the top of the
 * group and is gated by an IntersectionObserver on beat 0: hidden while
 * beat 0 dominates the viewport, fades in once beat 0 is mostly scrolled
 * past. The identity then persists through every subsequent beat without
 * re-mounting, so the chapter reads as one continuous editorial unit
 * with a fixed header rather than four independent pages.
 */
function ChapterGroupImpl(
  { slug, ariaLabel, className, identity, children }: Props,
  ref: Ref<HTMLElement>
) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  // Identity is hidden while beat 0 dominates the viewport. Flips true
  // once beat 0's intersection ratio drops below 0.5 (the reader is on
  // their way out of the cover beat).
  const [identityVisible, setIdentityVisible] = useState(false);

  useEffect(() => {
    if (!identity) return;
    if (typeof IntersectionObserver === "undefined") {
      // SSR / test fallback — assume identity should be visible so it
      // appears in the rendered DOM and aria tree.
      setIdentityVisible(true);
      return;
    }
    const target = sectionRef.current?.querySelector('[data-beat="0"]');
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIdentityVisible(entry.intersectionRatio < 0.5);
      },
      // Granular thresholds so the callback fires steadily during the
      // beat 0 → beat 1 transition rather than as one binary flip.
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [identity]);

  const assignRef = (node: HTMLElement | null) => {
    sectionRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  return (
    <section
      ref={assignRef}
      data-chapter={slug}
      data-chapter-group=""
      aria-label={ariaLabel}
      className={["relative w-full", className].filter(Boolean).join(" ")}
    >
      {identity ? (
        // Absolute wrapper that spans the whole group gives the sticky
        // child a sized containing block — sticky stays at viewport top
        // while the group is in view, scrolls with the group at its top
        // / bottom edges. `pointer-events: none` on the wrapper so the
        // overlay layer doesn't intercept clicks on beat content; the
        // identity itself re-enables `pointer-events: auto`.
        <div
          aria-hidden={identityVisible ? undefined : true}
          className="pointer-events-none absolute inset-0 z-10"
        >
          <div className="sticky top-0 px-6 pt-6 sm:px-10">
            <motion.div
              data-chapter-identity-mark=""
              initial={false}
              animate={{
                opacity: identityVisible ? 1 : 0,
                y: identityVisible ? 0 : -8,
              }}
              transition={{
                duration: reducedMotion ? 0 : 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ pointerEvents: identityVisible ? "auto" : "none" }}
            >
              {identity}
            </motion.div>
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const ChapterGroup = forwardRef(ChapterGroupImpl);
