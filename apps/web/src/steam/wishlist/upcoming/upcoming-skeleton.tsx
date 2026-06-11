import { ShimmerBlock } from "@/components/shimmer-block";

// Mirrors the Upcoming view layout (§ skeleton convention — reserve the real
// shape, not a generic shimmer): a frosted calendar block with a masthead, a
// weekday header, and week rows seeded with a few capsule-shaped tiles, then one
// band block. Keeps the swap-in reflow-free when the real calendar/bands mount.

function CapsuleShimmer() {
  return <ShimmerBlock className="aspect-[231/87] w-full rounded-md" />;
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex items-baseline gap-3">
        <ShimmerBlock className="h-7 w-28 rounded" />
        <ShimmerBlock className="h-3 w-24 rounded" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-7 gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <ShimmerBlock key={i} className="h-3 w-8 rounded" />
          ))}
        </div>
        {[0, 1, 2, 3].map((week) => (
          <div key={week} className="grid grid-cols-7 gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <div key={day} className="min-h-16 p-1">
                {(week + day) % 3 === 0 ? <CapsuleShimmer /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BandSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <ShimmerBlock className="h-4 w-32 rounded" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <CapsuleShimmer key={i} />
        ))}
      </div>
    </div>
  );
}

export function UpcomingSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <CalendarSkeleton />
      <BandSkeleton />
    </div>
  );
}
