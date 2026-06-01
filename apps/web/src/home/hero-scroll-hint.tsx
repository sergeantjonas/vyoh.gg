import { mainScrollRef } from "@/lib/scroll-container";
import { m, useReducedMotion, useScroll, useTransform } from "motion/react";

// Anonymous "scroll for more" affordance for the landing hero. The hero is
// `min-h-dvh`, which removed the earlier 85vh trick that leaked the next
// section into view as a scrollability signal. This chevron replaces that
// signal — stream-agnostic by construction so it survives the atmosphere
// arc's data-driven band reordering. When `useDominantStream` lands (see the
// atmosphere arc's open decisions), this primitive can be enriched with the
// leading band's name; until then it stays anonymous.
//
// Lifecycle: opacity is driven by <main>'s scrollY. The chevron is at full
// opacity at scrollTop=0 and clears by 80px of scroll — short enough that
// the moment the user commits to scrolling, the hint dissolves rather than
// trailing them through the rest of the page. Pointer-events track the same
// range so the button stops capturing clicks once it's visually gone.
const FADE_RANGE_PX = 80;

// Bob: small downward drift that returns. `ease: "easeInOut"` so the
// motion reads as a gentle breathing rhythm, not a jerk. ~2.2s cycle —
// fast enough to register, slow enough to stay editorial. (No `as const`
// because Motion types reject readonly keyframe arrays.)
const BOB_KEYFRAMES = { y: [0, 6, 0] };
const BOB_TRANSITION = {
  duration: 2.2,
  repeat: Number.POSITIVE_INFINITY,
  ease: "easeInOut" as const,
};

export function HeroScrollHint() {
  const reducedMotion = useReducedMotion();
  // `container: mainScrollRef` rather than the default window — <main> is the
  // actual scroll container (see the whileInView gate in BentoGrid for the
  // same reasoning), and a window-rooted useScroll would observe 0 forever
  // because the document body itself never scrolls in this app.
  const { scrollY } = useScroll({ container: mainScrollRef });
  const opacity = useTransform(scrollY, [0, FADE_RANGE_PX], [1, 0]);
  // Mirror the opacity fade in pointerEvents so a faded-out chevron stops
  // intercepting clicks over the bento tiles below it.
  const pointerEvents = useTransform(scrollY, (v) =>
    v < FADE_RANGE_PX ? "auto" : "none"
  );

  const handleClick = () => {
    const main = mainScrollRef.current;
    if (!main) return;
    // Advance by one viewport — lands just past the hero's bottom edge into
    // the first non-hero band. `scrollBy` rather than `scrollTo` so the jump
    // composes with any in-flight scroll from another source.
    main.scrollBy({
      top: main.clientHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <m.button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to next section"
      data-slot="hero-scroll-hint"
      className="absolute inset-x-0 bottom-8 mx-auto flex w-fit cursor-pointer justify-center rounded-full p-2 text-foreground/40 transition-colors hover:text-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={{ opacity, pointerEvents }}
    >
      <m.svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        role="presentation"
        focusable={false}
        {...(reducedMotion ? {} : { animate: BOB_KEYFRAMES, transition: BOB_TRANSITION })}
      >
        <path d="M6 9l6 6 6-6" />
      </m.svg>
    </m.button>
  );
}
