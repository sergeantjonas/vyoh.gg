import { ShimmerBlock } from "@/components/shimmer-block";
import { type Variants, m } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

export function MatchCardSkeleton() {
  return (
    <div className="relative flex h-28 items-center gap-4 overflow-hidden rounded-md border border-border/50 pl-3 pr-4">
      <div className="relative h-20 w-1 rounded-full bg-muted/50" />
      <div className="relative ml-auto flex flex-col items-end gap-2">
        <ShimmerBlock className="h-4 w-28 rounded" />
        <ShimmerBlock className="h-4 w-20 rounded" />
        <ShimmerBlock className="h-3 w-36 rounded" />
      </div>
    </div>
  );
}

export function MatchListSkeleton() {
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-3"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <m.li key={i} variants={item}>
          <MatchCardSkeleton />
        </m.li>
      ))}
    </m.ul>
  );
}
