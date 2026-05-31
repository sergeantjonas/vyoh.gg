import type { Variants } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;
const CHILD_DURATION = 0.5;

export const SECTION_STAGGER = 0.07;
export const SECTION_DELAY = 0.03;
export const SECTION_REDUCED_FADE_DURATION = 0.15;

export const SECTION_CHILD_WILL_CHANGE = "transform, opacity, filter";

export const sectionContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: SECTION_STAGGER,
      delayChildren: SECTION_DELAY,
    },
  },
};

export const sectionReducedContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: SECTION_REDUCED_FADE_DURATION },
  },
};

function child(y: number, blur: number): Variants {
  return {
    hidden: { opacity: 0, y, filter: `blur(${blur}px)` },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: CHILD_DURATION, ease: EASE },
    },
  };
}

export const sectionChildVariants = {
  eyebrow: child(6, 4),
  headline: child(14, 8),
  meta: child(8, 5),
  body: child(10, 6),
  // Card-sized blocks (bento tiles, summary panels). Slightly heavier than
  // `body` so the lift reads as a deliberate plate sliding into place.
  tile: child(12, 5),
} as const;

export type SectionChildRole = keyof typeof sectionChildVariants;
