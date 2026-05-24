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

function WishlistRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-4">
      <ShimmerBlock className="h-11.25 w-30 flex-none rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <ShimmerBlock className="h-4 w-3/5 rounded" />
        <ShimmerBlock className="h-3 w-2/5 rounded" />
      </div>
      <ShimmerBlock className="h-7 w-28 flex-none rounded-md" />
    </div>
  );
}

export function WishlistSkeleton() {
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-2"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <m.li key={i} variants={item}>
          <WishlistRowSkeleton />
        </m.li>
      ))}
    </m.ul>
  );
}
