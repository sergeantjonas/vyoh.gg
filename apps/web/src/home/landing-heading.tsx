import { m, useReducedMotion } from "motion/react";

import { EditorialHeading } from "@/components/ui/editorial-heading";
import {
  SECTION_CHILD_WILL_CHANGE,
  sectionChildVariants,
  sectionContainerVariants,
  sectionReducedContainerVariants,
} from "@/components/ui/section-variants";
import { OrbMark } from "@/home/orb-mark";

const MUTED_LINE_CLASS = "font-[360] text-muted-foreground/80 -tracking-[0.02em]";

export function LandingHeading() {
  const reducedMotion = useReducedMotion();
  const containerVariants = reducedMotion
    ? sectionReducedContainerVariants
    : sectionContainerVariants;

  return (
    <m.header
      className="flex flex-col items-center gap-4 text-center"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <OrbMark
        className="size-40 sm:size-56 lg:size-72 xl:size-80"
        entranceDelay={reducedMotion ? 0 : 0.7}
      />
      <m.p
        // Same trailing-letter-spacing fix as `next-chapter-caret.tsx`
        // (commit a62050f0). `tracking-[0.24em]` adds 0.24em after every
        // letter including the last, so the bounding box extends past the
        // final glyph by 0.24em; `flex items-center` centers the box,
        // shifting the visible glyphs left by ~half the trailing. Matching
        // `pl-[0.24em]` restores symmetric centering — both the eyebrow
        // and the bottom caret are then at viewport-center (column center
        // resolves to viewport center via `scrollbar-gutter: stable
        // both-edges` on <main>), so they sit on the same x-axis.
        className="pl-[0.24em] text-xs uppercase tracking-[0.24em] text-muted-foreground/80"
        {...(reducedMotion
          ? {}
          : {
              variants: sectionChildVariants.eyebrow,
              style: { willChange: SECTION_CHILD_WILL_CHANGE },
            })}
      >
        vyoh.gg
      </m.p>
      <EditorialHeading
        delegated
        magnitude="medium"
        className="font-[640] text-[clamp(1.5rem,3.6vw,2.5rem)] leading-[1.15] -tracking-[0.015em]"
        lineClassName={[undefined, undefined, MUTED_LINE_CLASS]}
      >
        {[
          "A self-portrait,",
          "forged in League of Legends, Steam,",
          "and whatever I plug in next.",
        ]}
      </EditorialHeading>
    </m.header>
  );
}
