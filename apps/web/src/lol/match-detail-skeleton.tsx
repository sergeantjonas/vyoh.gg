import { ShimmerBlock } from "@/components/shimmer-block";

function ParticipantRowSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-md border bg-card/60 p-2 backdrop-blur-sm">
      <ShimmerBlock className="size-9 rounded-md" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <ShimmerBlock className="h-4 w-24 rounded" />
        <ShimmerBlock className="h-3 w-16 rounded" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <ShimmerBlock className="h-5 w-32 rounded" />
        <ShimmerBlock className="h-3 w-24 rounded" />
      </div>
    </li>
  );
}

export function MatchDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <ShimmerBlock className="h-3 w-16 rounded" />
        <div className="flex items-baseline gap-3">
          <ShimmerBlock className="h-7 w-40 rounded" />
          <ShimmerBlock className="h-4 w-48 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((side) => (
          <section key={side} className="flex flex-col gap-2">
            <ShimmerBlock className="h-4 w-28 rounded" />
            <ul className="flex flex-col gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <ParticipantRowSkeleton key={i} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
