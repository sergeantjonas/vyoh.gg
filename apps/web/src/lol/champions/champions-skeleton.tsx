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

function ChampionRowSkeleton() {
  return (
    <div className="relative flex h-28 items-center gap-4 overflow-hidden rounded-md border border-border/50 pl-3 pr-4">
      <ShimmerBlock className="absolute inset-y-0 left-0 right-1/3 rounded-l-md opacity-50" />
      <div className="relative ml-auto flex flex-col items-end gap-2">
        <ShimmerBlock className="h-4 w-24 rounded" />
        <ShimmerBlock className="h-4 w-32 rounded" />
        <ShimmerBlock className="h-3 w-20 rounded" />
      </div>
    </div>
  );
}

export function ChampionsSkeleton() {
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-3"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <m.li key={i} variants={item}>
          <ChampionRowSkeleton />
        </m.li>
      ))}
    </m.ul>
  );
}
