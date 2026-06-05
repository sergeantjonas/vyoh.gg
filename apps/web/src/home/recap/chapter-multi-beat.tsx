import { useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  Children,
  type ReactNode,
  type Ref,
  forwardRef,
  isValidElement,
  useRef,
} from "react";

import { ChapterGroupNudgeContext } from "./chapter-group";
import { useChapterNudge } from "./use-chapter-nudge";
import { useMainScrollSnapClaim } from "./use-main-scroll-snap";

type Props = {
  /** Optional `data-chapter` slug for selectors / debugging. */
  slug?: string;
  /** Optional ARIA label for the section landmark. */
  ariaLabel?: string;
  className?: string;
  /**
   * Persistent chapter masthead rendered in normal flow at the top of
   * the chapter, with `position: sticky; top: 0`. Stays anchored at the
   * viewport top while the chapter is in view, releases when the next
   * chapter takes over. Children of the slot can call
   * `useChapterGroupNudge()` to drive their own entrance/exit animations
   * off the chapter's overall presence state.
   */
  identity?: ReactNode;
  /**
   * Masthead height as a CSS length expression. Drives both the
   * `<header>`'s `height` and the `--masthead-h` CSS variable that each
   * child `<MultiBeat>` reads for its `scroll-margin-top` and its
   * fixed-height calculation. Default `20vh`.
   */
  mastheadHeight?: string;
  children: ReactNode;
};

/**
 * Chapter wrapper for the multi-beat architecture (replaces the shipped
 * sticky-stage cross-fade pattern in [chapter-group.tsx](./chapter-group.tsx)).
 *
 * Architecture summary:
 * - Renders `<section data-chapter>` containing a sticky `<header>` masthead
 *   in normal flow followed by `<MultiBeat>` children, also in normal flow.
 * - Each `<MultiBeat>` is a viewport-tall (minus masthead) snap stop with
 *   `scroll-snap-stop: always`, so wheel and trackpad cannot skip or get
 *   stuck between beats.
 * - The masthead is `position: sticky; top: 0`, opaque over the beat
 *   content area. Persists across every beat in the chapter; releases
 *   when the chapter section scrolls past viewport top.
 * - Each beat reads `--masthead-h` (published as inline style on this
 *   section) to compute its `scroll-margin-top` and height. Set
 *   `mastheadHeight` per chapter if the masthead size differs.
 *
 * What this replaces:
 * - Today's [chapter-group.tsx](./chapter-group.tsx) sticky-stage stacks all beats
 *   as absolutely-positioned layers cross-fading via scroll progress —
 *   structurally forces cross-fade and leaves users stranded between
 *   beats (no per-beat snap force).
 *
 * Full background, choreography toolkit, and prior-art audit in
 * [multi-beat-chapter-arc.md](../../../docs/working-notes/cross-cutting/multi-beat-chapter-arc.md).
 *
 * Under `prefers-reduced-motion`: collapses to a flat vertical stack —
 * masthead loses its stickiness and beats render in document flow with
 * natural height. Same content, no motion. Snap stays (it's navigation).
 */
function ChapterMultiBeatImpl(
  { slug, ariaLabel, className, identity, mastheadHeight = "20vh", children }: Props,
  ref: Ref<HTMLElement>
) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const entered = useChapterNudge(sectionRef);

  // Claim `scroll-snap-type: y proximity` on `<main>` for the lifetime of
  // this chapter. Without this, the `scroll-snap-align: start` /
  // `scroll-snap-stop: always` classes on `<MultiBeat>` are inert — the
  // spec requires snap-type on the scroll container. Ref-counted so
  // multiple `<ChapterMultiBeat>` instances co-exist; original value
  // restored when the last one unmounts.
  useMainScrollSnapClaim();

  const beatCount = Children.toArray(children).filter(isValidElement).length;

  const assignRef = (node: HTMLElement | null) => {
    sectionRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  // Publish --masthead-h as an inline custom property so child <MultiBeat>
  // components can pick it up via CSS without a context handoff.
  const sectionStyle = { "--masthead-h": mastheadHeight } as CSSProperties;

  if (reducedMotion) {
    return (
      <ChapterGroupNudgeContext.Provider value={entered}>
        <section
          ref={assignRef}
          aria-roledescription="carousel"
          aria-label={ariaLabel}
          data-chapter={slug}
          data-chapter-multi-beat=""
          data-chapter-beat-count={beatCount}
          data-reduced-motion=""
          style={sectionStyle}
          className={["relative w-full", className].filter(Boolean).join(" ")}
        >
          {identity ? (
            <div data-chapter-masthead="" className="w-full">
              {identity}
            </div>
          ) : null}
          {children}
        </section>
      </ChapterGroupNudgeContext.Provider>
    );
  }

  return (
    <ChapterGroupNudgeContext.Provider value={entered}>
      <section
        ref={assignRef}
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        data-chapter={slug}
        data-chapter-multi-beat=""
        data-chapter-beat-count={beatCount}
        style={sectionStyle}
        className={["relative w-full", className].filter(Boolean).join(" ")}
      >
        {identity ? (
          // Sticky masthead in normal flow. Anchors to top of viewport
          // while chapter is in view; releases when chapter scrolls past.
          // `z-20` keeps it above beat content. Consumer is responsible
          // for the masthead's own background — the wrapper is structural
          // only, no opaque fill, so transparent mastheads still work.
          <header
            data-chapter-masthead=""
            className="sticky top-0 z-20 w-full"
            style={{ height: mastheadHeight }}
          >
            {identity}
          </header>
        ) : null}
        {children}
      </section>
    </ChapterGroupNudgeContext.Provider>
  );
}

export const ChapterMultiBeat = forwardRef(ChapterMultiBeatImpl);
