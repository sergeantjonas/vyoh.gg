import { ShimmerBlock } from "@/components/shimmer-block";
import type { MatchDetailTabId } from "@/lol/matches/match-detail-tabs";

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

function HeaderStripSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 rounded-md border bg-card/60 p-3 backdrop-blur-sm">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-6 w-10 rounded" />
          <ShimmerBlock className="h-3 w-14 rounded" />
        </div>
        <ShimmerBlock className="h-3 w-40 rounded" />
      </div>
      <ShimmerBlock className="h-3 w-4 rounded" />
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-3 w-14 rounded" />
          <ShimmerBlock className="h-6 w-10 rounded" />
        </div>
        <ShimmerBlock className="h-3 w-40 rounded" />
      </div>
    </div>
  );
}

function RecapSkeleton() {
  return (
    <>
      <HeaderStripSkeleton />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {[0, 1].map((side) => (
          <section key={side} className="flex flex-col gap-2">
            <ShimmerBlock className="h-4 w-28 rounded" />
            <ul className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <ParticipantRowSkeleton key={i} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function BuildOrderSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <ShimmerBlock className="h-4 w-24 rounded" />
        <ShimmerBlock className="h-5 w-32 rounded" />
      </div>
      <div className="flex items-center gap-2 rounded-md border bg-card/60 p-2 backdrop-blur-sm">
        <ShimmerBlock className="size-9 rounded-md" />
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <ShimmerBlock key={i} className="size-8 rounded-sm" />
          ))}
        </div>
      </div>
    </section>
  );
}

function SkillOrderSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <ShimmerBlock className="h-4 w-24 rounded" />
      <div className="flex flex-col gap-1.5 rounded-md border bg-card/60 p-3 backdrop-blur-sm">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-1.5">
            <ShimmerBlock className="h-4 w-4 rounded" />
            <div className="flex flex-1 gap-1">
              {Array.from({ length: 18 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-position skeleton cells
                <ShimmerBlock key={i} className="h-5 flex-1 rounded-sm" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LanePhaseSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <ShimmerBlock className="h-4 w-24 rounded" />
      <ShimmerBlock className="h-40 w-full rounded-md" />
    </section>
  );
}

function YourGameSkeleton() {
  return (
    <div className="flex gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <BuildOrderSkeleton />
        <SkillOrderSkeleton />
        <LanePhaseSkeleton />
      </div>
      <aside className="hidden w-28 shrink-0 flex-col gap-1.5 sm:flex">
        {[0, 1, 2].map((i) => (
          <ShimmerBlock key={i} className="h-4 w-20 rounded" />
        ))}
      </aside>
    </div>
  );
}

function GoldLeadSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <ShimmerBlock className="h-4 w-20 rounded" />
      <ShimmerBlock className="h-40 w-full rounded-md" />
    </section>
  );
}

function EventTimelinesSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <ShimmerBlock className="h-4 w-44 rounded" />
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-2">
            <ShimmerBlock className="h-3 w-10 rounded" />
            <ShimmerBlock className="h-7 flex-1 rounded-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelineSkeleton() {
  return (
    <>
      <GoldLeadSkeleton />
      <EventTimelinesSkeleton />
    </>
  );
}

export function MatchDetailSkeleton({ tab = "recap" }: { tab?: MatchDetailTabId }) {
  return (
    <div className="flex flex-col gap-6">
      {tab === "recap" && <RecapSkeleton />}
      {tab === "your-game" && <YourGameSkeleton />}
      {tab === "timeline" && <TimelineSkeleton />}
    </div>
  );
}
