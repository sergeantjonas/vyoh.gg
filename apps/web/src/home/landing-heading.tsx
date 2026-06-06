import { m, useReducedMotion } from "motion/react";

import { EditorialHeading } from "@/components/ui/editorial-heading";
import {
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
      {/* Magazine-style kicker line — orients the visitor before the
          orb + heading do their editorial entrance. Tracked uppercase
          register pairs with the eyebrow voice used throughout the
          recap chapters ("VYOH'S AHRI", "STEAM · THIS SEASON"). Small
          enough to feel like a margin marker rather than a heading.
          The leading `·` is the kicker's visual anchor — magazine
          spreads often open with a bullet that holds the section
          identity. */}
      <p className="font-medium text-[10px] text-muted-foreground/70 uppercase tracking-[0.3em] sm:text-xs">
        Vyoh.gg <span aria-hidden="true">·</span> Living self-portrait
      </p>
      <OrbMark
        className="size-40 sm:size-56 lg:size-72 xl:size-80"
        entranceDelay={reducedMotion ? 0 : 0.7}
      />
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
