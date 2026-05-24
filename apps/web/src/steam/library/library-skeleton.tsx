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
    <div className="relative h-32 overflow-hidden rounded-lg border border-border/40 bg-card/50 sm:h-36">
      <ShimmerBlock className="absolute inset-0 size-full rounded-none" />
      <div className="absolute inset-0 bg-linear-to-r from-black/40 via-black/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center gap-2 px-4 sm:px-5">
        <ShimmerBlock className="h-7 w-40 rounded sm:h-8 sm:w-52" />
        <ShimmerBlock className="h-3 w-32 rounded" />
      </div>
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
      className="flex flex-col gap-2"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <m.li key={i} variants={item}>
          <LibraryRowSkeleton />
        </m.li>
      ))}
    </m.ul>
  );
}
