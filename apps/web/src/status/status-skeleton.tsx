import { ShimmerBlock } from "@/components/shimmer-block";

// Mirrors the status page top to bottom (§ skeleton convention — reserve the
// real shape, not a generic shimmer): masthead, the match-sync card with its
// three metrics and account rows, the two sync-job cards sized to the job
// catalog (2 LoL, 9 Steam), then the app-window grid. The rate-limiter table
// and tick history sit below the fold and are left to mount in place.

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function JobsCardSkeleton({
  rows,
  descriptionLines,
}: { rows: number; descriptionLines: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <ShimmerBlock className="h-4 w-32 rounded" />
        <div className="flex flex-col items-end gap-1">
          {range(descriptionLines).map((i) => (
            <ShimmerBlock key={i} className="h-3 w-72 rounded" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {range(rows).map((i) => (
          <ShimmerBlock key={i} className="h-7 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

function SyncCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-start justify-between">
        <ShimmerBlock className="h-4 w-28 rounded" />
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <ShimmerBlock className="h-8 w-24 rounded-md" />
            <ShimmerBlock className="h-8 w-20 rounded-md" />
          </div>
          <ShimmerBlock className="h-3 w-28 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {range(3).map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <ShimmerBlock className="h-3 w-16 rounded" />
            <ShimmerBlock className="h-4 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {range(4).map((i) => (
          <ShimmerBlock key={i} className="h-7 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function StatusSkeleton() {
  return (
    <output aria-busy="true" aria-label="Loading status" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <ShimmerBlock className="h-7 w-24 rounded" />
        <ShimmerBlock className="h-3.5 w-full max-w-xl rounded" />
      </div>
      <SyncCardSkeleton />
      <JobsCardSkeleton rows={2} descriptionLines={2} />
      <JobsCardSkeleton rows={9} descriptionLines={3} />
      <div className="flex flex-col gap-3 rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <ShimmerBlock className="h-4 w-56 rounded" />
          <div className="flex flex-col items-end gap-1">
            <ShimmerBlock className="h-3 w-72 rounded" />
            <ShimmerBlock className="h-3 w-48 rounded" />
          </div>
        </div>
        <div className="grid gap-1.5 md:grid-cols-2">
          {range(4).map((i) => (
            <ShimmerBlock key={i} className="h-[66px] w-full rounded-md" />
          ))}
        </div>
      </div>
    </output>
  );
}
