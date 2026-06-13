import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { mainScrollRef } from "@/lib/scroll-container";

import { SHADOW_LABEL } from "./chapter-shadows";

/**
 * Floating "advance to next chapter" affordance. Renders at viewport bottom
 * whenever the current scroll position has at least one
 * `[data-recap-chapter]` element ahead of it; hides past the last chapter.
 *
 * Replaces the hero-only `HeroScrollHint`. The chapter primitive doesn't
 * own the caret — chapter components only need their existing
 * `data-recap-chapter` + `data-chapter-label` attributes for the caret to
 * discover them.
 *
 * Discovery is DOM-based, not via a React context registry. Re-runs on:
 *  - mount (initial)
 *  - scroll (user moves through the page)
 *  - resize (viewport changes affect target positions)
 *  - DOM mutation (chapters mount asynchronously after their query hooks
 *    resolve — e.g. AhriChapter waits on usePrimaryAccount, SteamChapter's
 *    data-chapter-label updates from fallback to game name once
 *    useSteamGameRecap resolves)
 *
 * The mutation path is what makes the caret correct at hero scrollTop=0
 * when chapters lazy-mount: without it, the initial compute runs against
 * an empty DOM and the caret either stays hidden or latches onto whatever
 * chapter happened to mount first.
 */

// Skip-to-next dead-zone in pixels. When the user is sitting near the top
// of a chapter (just landed via nudge), the "next chapter" should be the
// FOLLOWING one, not the current one.
const SKIP_PAST_PX = 80;

// The gentle downward bob is a compositor CSS animation (`.caret-bob` in
// motion.css), not a Motion `animate` loop: Motion would write `transform`
// to this always-mounted element's inline style every frame, churning style
// recalc and flooding Chrome DevTools' Styles pane with styleSheetChanged
// events (perpetual spinner). The CSS keyframe runs on the compositor and
// touches no DOM. Reduced motion is handled by the `@media` guard there.

// Past the last chapter we hide the caret rather than flipping to a
// back-to-top affordance — the global <ScrollToTop /> (bottom-right
// corner, fires above scrollTop > 500px) already covers that intent.
// A second back-to-top control at bottom-center would duplicate it and
// blur the caret's editorial role of advancing the reader through
// chapters.
type NextChapter = {
  /** Scroll target — absolute scrollTop where this chapter's outer top sits. */
  top: number;
  label: string;
};

export function NextChapterCaret() {
  const reducedMotion = useReducedMotion();
  const [next, setNext] = useState<NextChapter | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function compute() {
      const main = mainScrollRef.current;
      const chapters = Array.from(
        document.querySelectorAll<HTMLElement>("[data-recap-chapter]")
      );
      if (chapters.length === 0) {
        setNext(null);
        return;
      }
      const rootTop = main?.getBoundingClientRect().top ?? 0;
      const rootScroll = main?.scrollTop ?? window.scrollY;
      // Hide the caret once the bottom of the page is in view — there's
      // nothing further to advance to even if a chapter's outer-top is
      // still numerically ahead of `rootScroll`. This happens when the
      // last "chapter" (the conclusion) is shorter than the viewport: the
      // user can scroll to max-scroll while the conclusion's top remains
      // 80+px below `rootScroll`, which would otherwise keep the caret
      // pointing at it.
      const clientHeight = main?.clientHeight;
      const scrollHeight = main?.scrollHeight;
      if (
        typeof clientHeight === "number" &&
        typeof scrollHeight === "number" &&
        rootScroll + clientHeight >= scrollHeight - 4
      ) {
        setNext(null);
        return;
      }
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
      // Avoid pointless React renders when nothing changed — caret is
      // re-computed on every scroll tick.
      setNext((prev) => {
        if (prev === null && candidate === null) return prev;
        if (
          prev !== null &&
          candidate !== null &&
          prev.top === candidate.top &&
          prev.label === candidate.label
        ) {
          return prev;
        }
        return candidate;
      });
    }

    compute();
    const scrollTarget = mainScrollRef.current ?? window;
    scrollTarget.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute, { passive: true });
    // MutationObserver catches the two async-mount cases that initial
    // compute + scroll/resize miss:
    //   1. AhriChapter mounts after usePrimaryAccount resolves (chapter
    //      appears in DOM after caret's first compute).
    //   2. SteamChapter's data-chapter-label flips from fallback ("Steam
    //      game 2050650") to the actual game name once useSteamGameRecap
    //      resolves.
    // Subtree + attribute filter is cheap — the document body's mutations
    // outside the chapter region don't affect what we compute, and the
    // observer only fires on the small set of mutations we care about.
    const observer = new MutationObserver(compute);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-chapter-label", "data-recap-chapter"],
    });
    return () => {
      scrollTarget.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
      observer.disconnect();
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
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Scroll to ${next.label}`}
      data-slot="next-chapter-caret"
      // Bare typography on a fixed-bottom anchor — no pill, no backdrop.
      // The text-shadow tier handles legibility against any backdrop the
      // user happens to be over (bright splash, ambient hero, atmospheric
      // bg). Matches the chapter editorial register; a pill background
      // read as a UI module dropped on top of the magazine spread.
      className="-translate-x-1/2 fixed bottom-5 left-1/2 z-40 flex cursor-pointer flex-col items-center gap-1 text-foreground/60 transition-colors hover:text-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span
        className="text-[10px] font-medium uppercase tracking-[0.22em]"
        style={{ textShadow: SHADOW_LABEL }}
      >
        {next.label}
      </span>
      <svg
        viewBox="0 0 24 24"
        className="caret-bob size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="presentation"
        focusable={false}
        style={{
          filter:
            "drop-shadow(0 1px 0 rgba(0,0,0,0.9)) drop-shadow(0 1px 4px rgba(0,0,0,0.55))",
        }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}
