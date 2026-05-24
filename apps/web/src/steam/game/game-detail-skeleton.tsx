import { ShimmerBlock } from "@/components/shimmer-block";
import { type Variants, m } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

function TitleSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <ShimmerBlock className="h-7 w-56 rounded" />
      <ShimmerBlock className="h-4 w-full max-w-lg rounded" />
    </div>
  );
}

function PlaytimeCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <ShimmerBlock className="h-4 w-20 rounded" />
        <ShimmerBlock className="h-4 w-14 rounded" />
      </div>
      <div className="flex items-center justify-between gap-4">
        <ShimmerBlock className="h-4 w-28 rounded" />
        <ShimmerBlock className="h-4 w-10 rounded" />
      </div>
    </div>
  );
}

function ScreenshotStripSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <ShimmerBlock key={i} className="aspect-video w-64 flex-none rounded-md" />
      ))}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
      <ShimmerBlock className="h-3 w-24 rounded" />
      <ShimmerBlock className="h-6 w-32 rounded" />
      <ShimmerBlock className="h-3 w-full rounded" />
    </div>
  );
}

function AchievementPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <ShimmerBlock className="h-5 w-32 rounded" />
        <ShimmerBlock className="h-4 w-20 rounded" />
      </div>
      <ShimmerBlock className="h-2 w-full rounded-full" />
      <div className="flex flex-col gap-2 pt-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <ShimmerBlock className="size-10 flex-none rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <ShimmerBlock className="h-4 w-2/3 rounded" />
              <ShimmerBlock className="h-3 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameDetailSkeleton() {
  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6"
    >
      <m.div variants={item}>
        <TitleSkeleton />
      </m.div>
      <m.div variants={item}>
        <PlaytimeCardSkeleton />
      </m.div>
      <m.div variants={item}>
        <ScreenshotStripSkeleton />
      </m.div>
      <m.div variants={item} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </m.div>
      <m.div variants={item}>
        <AchievementPanelSkeleton />
      </m.div>
    </m.div>
  );
}
