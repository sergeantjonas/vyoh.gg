import { ShimmerBlock } from "@/components/shimmer-block";
import { type Variants, m } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

function StatCardSkeleton() {
  return (
    <m.div variants={item} className="flex flex-col gap-2 rounded-lg border p-4">
      <ShimmerBlock className="h-3 w-16 rounded" />
      <ShimmerBlock className="h-7 w-24 rounded" />
      <ShimmerBlock className="h-3 w-20 rounded" />
    </m.div>
  );
}

export function TrendsSkeleton() {
  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-8"
    >
      <m.div variants={item} className="grid grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </m.div>

      <m.section variants={item} className="flex flex-col gap-2">
        <ShimmerBlock className="h-3 w-24 rounded" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 20 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size placeholder grid
            <ShimmerBlock key={i} className="size-3 rounded-full" />
          ))}
        </div>
      </m.section>

      <m.section variants={item} className="flex flex-col gap-2">
        <ShimmerBlock className="h-3 w-16 rounded" />
        <ShimmerBlock className="h-32 w-full rounded-md" />
      </m.section>

      <m.section variants={item} className="flex flex-col gap-2">
        <ShimmerBlock className="h-3 w-20 rounded" />
        <ShimmerBlock className="h-48 w-full rounded-md" />
      </m.section>

      <m.section variants={item} className="flex flex-col gap-2">
        <ShimmerBlock className="h-3 w-32 rounded" />
        <div className="grid grid-cols-[1fr_auto] items-center gap-6">
          <ShimmerBlock className="h-56 w-full rounded-md" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size placeholder rows
              <ShimmerBlock key={i} className="h-3 w-32 rounded" />
            ))}
          </div>
        </div>
      </m.section>
    </m.div>
  );
}
