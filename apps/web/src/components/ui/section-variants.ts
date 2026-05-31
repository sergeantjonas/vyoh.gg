import type { Variants } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;
const CHILD_DURATION = 0.55;

export const SECTION_STAGGER = 0.09;
export const SECTION_DELAY = 0.04;
export const SECTION_REDUCED_FADE_DURATION = 0.15;

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

function child(y: number): Variants {
  return {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: CHILD_DURATION, ease: EASE },
    },
  };
}

export const sectionChildVariants = {
  eyebrow: child(8),
  headline: child(20),
  meta: child(10),
  body: child(14),
} as const;

export type SectionChildRole = keyof typeof sectionChildVariants;
