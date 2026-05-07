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

function ShimmerBlock({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden bg-muted/40 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export function MatchCardSkeleton() {
  return (
    <div className="relative flex h-28 items-center gap-4 overflow-hidden rounded-md border pl-3 pr-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 right-1/3 bg-gradient-to-br from-muted/30 via-muted/15 to-transparent" />
      <div className="pointer-events-none absolute left-[12%] top-1/2 size-24 -translate-y-1/2 rounded-full bg-muted/15 blur-2xl" />
      <div className="relative h-20 w-1 rounded-full bg-muted" />
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
