import { m, useReducedMotion } from "motion/react";
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

// Bob keyframes — mirrors HeroScrollHint's gentle downward drift so the
// caret reads as ambient/breathing rather than alarming. No `as const`
// because Motion's keyframe types reject readonly arrays. The top-state
// caret bobs upward to match its chevron direction.
const BOB_KEYFRAMES_DOWN = { y: [0, 4, 0] };
const BOB_KEYFRAMES_UP = { y: [0, -4, 0] };
const BOB_TRANSITION = {
  duration: 2.2,
  repeat: Number.POSITIVE_INFINITY,
  ease: "easeInOut" as const,
};

// SVG paths for the two chevron orientations. Swapped via keyed remount
// (see render below) so the state flip reads as a discrete page-turn
// moment, mirroring how chapter labels already hard-swap as the user
// crosses each chapter boundary.
const CHEVRON_DOWN = "M6 9l6 6 6-6";
const CHEVRON_UP = "M6 15l6-6 6 6";

type CaretTarget =
  | {
      kind: "chapter";
      /** Scroll target — absolute scrollTop where this chapter's outer top sits. */
      top: number;
      label: string;
    }
  | { kind: "top" };

export function NextChapterCaret() {
  const reducedMotion = useReducedMotion();
  const [target, setTarget] = useState<CaretTarget | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function compute() {
      const main = mainScrollRef.current;
      const chapters = Array.from(
        document.querySelectorAll<HTMLElement>("[data-recap-chapter]")
      );
      if (chapters.length === 0) {
        setTarget(null);
        return;
      }
      const rootTop = main?.getBoundingClientRect().top ?? 0;
      const rootScroll = main?.scrollTop ?? window.scrollY;
      let candidate: CaretTarget | null = null;
      for (const el of chapters) {
        const elTop = rootScroll + el.getBoundingClientRect().top - rootTop;
        if (elTop > rootScroll + SKIP_PAST_PX) {
          candidate = {
            kind: "chapter",
            top: elTop,
            label: el.dataset.chapterLabel ?? "Next",
          };
          break;
        }
      }
      // Past the last chapter — flip to "back to top". The state still
      // renders (vs. earlier `setNext(null)` which hid the caret), so
      // the user always has a one-click way back to the hero from the
      // post-chapter zone.
      if (candidate === null) {
        candidate = { kind: "top" };
      }
      // Avoid pointless React renders when nothing changed — caret is
      // re-computed on every scroll tick.
      setTarget((prev) => {
        if (prev === null && candidate === null) return prev;
        if (prev?.kind === "top" && candidate?.kind === "top") return prev;
        if (
          prev?.kind === "chapter" &&
          candidate?.kind === "chapter" &&
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
    if (!main || !target) return;
    main.scrollTo({
      top: target.kind === "chapter" ? target.top : 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [target, reducedMotion]);

  if (!target) return null;

  const isTop = target.kind === "top";
  const label = isTop ? "Top" : target.label;
  const bobKeyframes = isTop ? BOB_KEYFRAMES_UP : BOB_KEYFRAMES_DOWN;
  const chevronPath = isTop ? CHEVRON_UP : CHEVRON_DOWN;

  return (
    <m.button
      type="button"
      onClick={handleClick}
      aria-label={isTop ? "Scroll back to top" : `Scroll to ${label}`}
      data-slot="next-chapter-caret"
      data-caret-kind={target.kind}
      // Bare typography on a fixed-bottom anchor — no pill, no backdrop.
      // The text-shadow tier handles legibility against any backdrop the
      // user happens to be over (bright splash, ambient hero, atmospheric
      // bg). Matches the chapter editorial register; a pill background
      // read as a UI module dropped on top of the magazine spread.
      className="-translate-x-1/2 fixed bottom-5 left-1/2 z-40 flex cursor-pointer flex-col items-center gap-1 text-foreground/60 transition-colors hover:text-foreground/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {/* Inner content is keyed on caret kind so the chapter→top flip
          remounts the label + chevron. Same hard-swap pattern the label
          already uses when crossing chapter boundaries (Ahri → Silksong),
          extended to cover the structural "no chapters ahead" state. */}
      <span
        key={`label-${target.kind}`}
        className="text-[10px] font-medium uppercase tracking-[0.22em]"
        style={{ textShadow: SHADOW_LABEL }}
      >
        {label}
      </span>
      <m.svg
        key={`chevron-${target.kind}`}
        viewBox="0 0 24 24"
        className="size-5"
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
        {...(reducedMotion ? {} : { animate: bobKeyframes, transition: BOB_TRANSITION })}
      >
        <path d={chevronPath} />
      </m.svg>
    </m.button>
  );
}
