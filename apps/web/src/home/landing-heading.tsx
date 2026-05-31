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
        className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80"
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
