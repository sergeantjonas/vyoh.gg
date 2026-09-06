import type { Variants } from "motion/react";

export const itemsContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

export const itemReveal: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 26 },
  },
};

// Note: entrance animations on these wrappers used to fade opacity 0→1.
// That made every descendant's `backdrop-filter` stop painting until the
// fade settled (ancestor opacity < 1 creates a stacking context that
// suppresses backdrop-filter rendering), which is what produced the
// "frosted cards are transparent first, then suddenly blurred" pop. The
// stagger + y-translate is enough entrance signal on its own; dropping the
// opacity keeps the motion without sabotaging the frosted look.
export const teamContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const teamRow: Variants = {
  hidden: { y: 6 },
  show: {
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};
