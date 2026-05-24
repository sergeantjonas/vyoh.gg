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
    <div className="relative h-32 overflow-hidden rounded-lg border border-border/40 bg-card/50 sm:h-36">
      <ShimmerBlock className="absolute inset-0 size-full rounded-none" />
      <div className="absolute inset-0 bg-linear-to-r from-black/40 via-black/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center gap-2 px-4 sm:px-5">
        <ShimmerBlock className="h-7 w-44 rounded sm:h-8 sm:w-56" />
        <ShimmerBlock className="h-3 w-36 rounded" />
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center pr-4 sm:pr-5">
        <ShimmerBlock className="size-4 rounded" />
      </div>
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
