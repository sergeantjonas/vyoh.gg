import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";
import type * as React from "react";

// Chapter wrappers carry the frosted recipe — each sits directly over the
// splash backdrop (the recap claims a champion splash via useSplashChampion
// in the route), so the wrapper is the boundary glass layer. Inner tiles
// nested below stay bare (`bg-card/50`) per the one-level-of-glass rule.
// `rounded-xl` (vs the tile-default rounded-md/lg) is deliberate for chapter
// outers — the larger radius marks the editorial band scale.
//
// The class consts are exported for chapters that drive their own variants
// cascade (recap-signature-game) and can't take the component's viewport
// entrance; everything else renders <ChapterShell>.
const CHAPTER_SHELL_CLASS =
  "flex flex-col gap-4 rounded-xl border bg-card/60 p-6 backdrop-blur-sm sm:p-8";
const CHAPTER_SHELL_EMPTY_CLASS =
  "flex flex-col gap-3 rounded-xl border bg-card/60 p-6 backdrop-blur-sm";

/**
 * Recap chapter outer: frosted m.section with the shared viewport-entry
 * choreography. `populated` picks the fuller variant (longer throw, custom
 * ease, sm:p-8) used when the chapter has real content; the default is the
 * quieter empty-state entrance.
 */
function ChapterShell({
  populated = false,
  className,
  children,
}: {
  populated?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <m.section
      layout
      initial={reduced ? false : { opacity: 0, y: populated ? 32 : 16 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={
        populated
          ? { duration: 0.7, ease: [0.32, 0.72, 0, 1] }
          : { duration: 0.6, ease: "easeOut" }
      }
      className={cn(
        populated ? CHAPTER_SHELL_CLASS : CHAPTER_SHELL_EMPTY_CLASS,
        className
      )}
    >
      {children}
    </m.section>
  );
}

export { CHAPTER_SHELL_CLASS, CHAPTER_SHELL_EMPTY_CLASS, ChapterShell };
