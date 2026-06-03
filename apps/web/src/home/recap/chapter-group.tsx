import {
  type ReactNode,
  type Ref,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { useChapterNudge } from "./use-chapter-nudge";

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /**
   * Persistent chapter title card rendered sticky at the top of the
   * group. This is the chapter's editorial constant — typically the
   * eyebrow + masthead + tagline that identify the chapter. Stays
   * visible across every beat while beat content changes underneath,
   * so the reader perceives the chapter as one continuous editorial
   * unit with a fixed header rather than four independent pages.
   *
   * Renders once at the group level rather than re-mounting per beat —
   * the title card is the chapter's constant under which content swaps,
   * which keeps the masthead visually anchored as the reader scrolls
   * and lets per-beat content animations go bolder.
   *
   * The slot's children can call `useChapterGroupNudge()` to drive their
   * own entrance + exit animations off the chapter's overall presence
   * state.
   */
  identity?: ReactNode;
  children: ReactNode;
};

/**
 * Combined presence flag for a chapter — `true` while the chapter has
 * been entered AND has not yet started exiting. Title cards use this to
 * cascade in when the chapter is engaged and reverse out as it leaves,
 * which avoids the "next chapter's title card pushes the old one out of
 * the way" collision two adjacent stickies would otherwise produce at a
 * chapter boundary.
 */
const ChapterGroupNudgeContext = createContext(false);

export function useChapterGroupNudge(): boolean {
  return useContext(ChapterGroupNudgeContext);
}

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
 * group and is gated by the chapter's combined presence state: fades in
 * when the section reaches the standard `useChapterNudge` threshold
 * (entering), fades out when the chapter's last beat is mostly visible
 * (exiting). The fade-out lets the next chapter's title card take the
 * top-of-viewport slot cleanly instead of crowding against the current
 * one during the boundary scroll.
 */
function ChapterGroupImpl(
  { slug, ariaLabel, className, identity, children }: Props,
  ref: Ref<HTMLElement>
) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const entering = useChapterNudge(sectionRef);
  // Exiting: position-based detection via a direct scroll listener on
  // <main> (the actual scroll container). Flips true when the reader has
  // scrolled past the last beat's top edge by more than a small buffer.
  //
  // History: a threshold-based IntersectionObserver (thresholds at
  // 0.5/0.75/0.9/0.95/1) was unreliable on back-scroll — fast scrolls or
  // snaps that settled between thresholds left the LAST fired callback
  // with the old exiting=true state, and no further threshold crossings
  // happened to re-evaluate at the snapped position. Manual scroll
  // listener fires every scroll frame, computes the rect directly, and
  // doesn't depend on threshold spacing.
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!identity) return;
    const section = sectionRef.current;
    if (!section) return;
    const container: HTMLElement | Window = mainScrollRef.current ?? window;

    const compute = () => {
      const beats = section.querySelectorAll("[data-beat]");
      const lastBeat = beats[beats.length - 1] as HTMLElement | undefined;
      if (!lastBeat) return;
      const top = lastBeat.getBoundingClientRect().top;
      // -10px buffer: snap-precision can leave top at -1..-5px after
      // settle even when the reader is "on" the last beat. Without the
      // buffer the title card would flicker off briefly on snap-end.
      setExiting(top < -10);
    };

    compute();
    container.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute, { passive: true });
    return () => {
      container.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [identity]);

  const presenceVisible = entering && !exiting;

  const assignRef = (node: HTMLElement | null) => {
    sectionRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  return (
    <ChapterGroupNudgeContext.Provider value={presenceVisible}>
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
          // identity content itself re-enables `pointer-events: auto`.
          <div
            data-chapter-identity-mark=""
            className="pointer-events-none absolute inset-0 z-10"
          >
            <div className="sticky top-0">
              <div className="pointer-events-auto">{identity}</div>
            </div>
          </div>
        ) : null}
        {children}
      </section>
    </ChapterGroupNudgeContext.Provider>
  );
}

export const ChapterGroup = forwardRef(ChapterGroupImpl);
