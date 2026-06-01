import { m, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

/**
 * Floating "advance to next chapter" affordance. Renders at viewport bottom
 * whenever the current scroll position has at least one
 * `[data-recap-chapter]` element ahead of it; hides past the last chapter.
 *
 * Replaces the hero-only `HeroScrollHint`. The chapter primitive doesn't
 * own the caret — chapter components only need their existing
 * `data-recap-chapter` + new `data-chapter-label` attributes for the
 * caret to discover them. Decoupling navigation from chapter content
 * means moment chapters / future surfaces opt in for free.
 *
 * Discovery is DOM-based rather than via a React context registry — the
 * scroll listener runs hot, but `querySelectorAll` on a handful of
 * `[data-recap-chapter]` elements is cheap, and we avoid threading a
 * registry through every chapter mount.
 */

// Skip-to-next dead-zone in pixels. When the user is sitting near the top
// of a chapter (just landed via nudge), the "next chapter" should be the
// FOLLOWING one, not the current one. Pixel-distance guard rather than
// percentage so it works the same across viewport sizes.
const SKIP_PAST_PX = 80;

// Bob keyframes — mirrors HeroScrollHint's gentle downward drift so the
// caret reads as ambient/breathing rather than alarming. No `as const`
// because Motion's keyframe types reject readonly arrays.
const BOB_KEYFRAMES = { y: [0, 6, 0] };
const BOB_TRANSITION = {
  duration: 2.2,
  repeat: Number.POSITIVE_INFINITY,
  ease: "easeInOut" as const,
};

type NextChapter = {
  /** Scroll target — absolute scrollTop where this chapter's outer top sits. */
  top: number;
  label: string;
};

export function NextChapterCaret() {
  const reducedMotion = useReducedMotion();
  const [next, setNext] = useState<NextChapter | null>(null);

  // Compute the next chapter from current scroll position. Runs on mount,
  // on every scroll tick, and on resize. Cheap enough for hot-loop usage
  // (handful of DOM elements, a few rect reads).
  useEffect(() => {
    const main = mainScrollRef.current;
    if (typeof window === "undefined") return;

    function compute() {
      const chapters = Array.from(
        document.querySelectorAll<HTMLElement>("[data-recap-chapter]")
      );
      if (chapters.length === 0) {
        setNext(null);
        return;
      }
      const root = main;
      const rootTop = root?.getBoundingClientRect().top ?? 0;
      const rootScroll = root?.scrollTop ?? window.scrollY;
      // Find the first chapter whose top is past the current scroll
      // position by more than SKIP_PAST_PX. The dead-zone keeps the caret
      // pointing FORWARD after a landing nudge — without it, sitting at
      // the top of a chapter would have the caret point at the same
      // chapter we're already on.
      let candidate: NextChapter | null = null;
      for (const el of chapters) {
        const elTop = rootScroll + el.getBoundingClientRect().top - rootTop;
        if (elTop > rootScroll + SKIP_PAST_PX) {
          candidate = {
            top: elTop,
            label: el.dataset.chapterLabel ?? "Next",
          };
          break;
        }
      }
      setNext(candidate);
    }

    compute();
    const scrollTarget = main ?? window;
    scrollTarget.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute, { passive: true });
    return () => {
      scrollTarget.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  const handleClick = useCallback(() => {
    const main = mainScrollRef.current;
    if (!main || !next) return;
    main.scrollTo({
      top: next.top,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [next, reducedMotion]);

  if (!next) return null;

  return (
    <m.button
      type="button"
      onClick={handleClick}
      aria-label={`Scroll to ${next.label}`}
      data-slot="next-chapter-caret"
      // Fixed (not absolute) so the caret rides the viewport across every
      // chapter, not just the hero. bottom-4 keeps it below the typical
      // chapter CTA position without overlapping. Backdrop scrim gives the
      // chip enough contrast against any splash crop.
      className="fixed inset-x-0 bottom-4 mx-auto z-40 flex w-fit cursor-pointer flex-col items-center gap-1 rounded-full bg-black/40 px-4 py-2 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-black/55 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <m.svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="presentation"
        focusable={false}
        {...(reducedMotion ? {} : { animate: BOB_KEYFRAMES, transition: BOB_TRANSITION })}
      >
        <path d="M6 9l6 6 6-6" />
      </m.svg>
      <span
        className="text-[10px] font-medium uppercase tracking-[0.2em]"
        style={{
          textShadow:
            "0 1px 0 rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.55)",
        }}
      >
        {next.label}
      </span>
    </m.button>
  );
}
