import { m, useReducedMotion } from "motion/react";

import { EditorialHeading } from "@/components/ui/editorial-heading";
import {
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
      className="flex flex-col items-center gap-6 text-center"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <OrbMark className="size-44 sm:size-56" />
      <m.p
        className="text-xs uppercase tracking-[0.24em] text-muted-foreground/80 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.7),0_0_8px_rgb(0_0_0_/_0.5)]"
        {...(reducedMotion ? {} : { variants: sectionChildVariants.eyebrow })}
      >
        vyoh.gg
      </m.p>
      <EditorialHeading
        delegated
        magnitude="large"
        className="font-[720] text-[clamp(3.25rem,8.5vw,7rem)] leading-[0.98] -tracking-[0.03em]"
        lineClassName={[undefined, MUTED_LINE_CLASS]}
      >
        {["A self-portrait,", "in League and Steam."]}
      </EditorialHeading>
    </m.header>
  );
}
