import { ShimmerBlock } from "@/components/shimmer-block";
import { type Variants, m } from "motion/react";
import type { LibraryLayout } from "./use-library-prefs";

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

function LibraryTileSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <ShimmerBlock className="aspect-[460/215] w-full rounded-md" />
      <ShimmerBlock className="h-4 w-3/4 rounded" />
      <ShimmerBlock className="h-3 w-1/2 rounded" />
    </div>
  );
}

function LibraryRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3">
      <ShimmerBlock className="h-11.25 w-30 flex-none rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <ShimmerBlock className="h-4 w-2/3 rounded" />
        <ShimmerBlock className="h-3 w-1/3 rounded" />
      </div>
      <ShimmerBlock className="h-4 w-16 flex-none rounded" />
    </div>
  );
}

export function LibrarySkeleton({ layout }: { layout: LibraryLayout }) {
  if (layout === "tiles") {
    return (
      <m.ul
        initial="hidden"
        animate="show"
        variants={container}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <m.li key={i} variants={item}>
            <LibraryTileSkeleton />
          </m.li>
        ))}
      </m.ul>
    );
  }

  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col divide-y divide-border/40 rounded-lg border bg-card/50"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <m.li key={i} variants={item}>
          <LibraryRowSkeleton />
        </m.li>
      ))}
    </m.ul>
  );
}
