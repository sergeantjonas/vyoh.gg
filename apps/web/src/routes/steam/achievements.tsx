import {
  EMPTY_FRAME_CLASS,
  EmptyAchievementsIllustration,
  EmptyState,
} from "@/components/empty-state";
import { routeMeta } from "@/lib/route-meta";
import { RecentUnlocksVirtual } from "@/steam/achievements/recent-unlocks-virtual";
import { recentUnlocksQueryOptions, useRecentUnlocks } from "@/steam/use-recent-unlocks";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { SteamRecentUnlock } from "@vyoh/shared";
import { ArrowRight } from "lucide-react";

const FEED_LIMIT = 100;

export const Route = createFileRoute("/steam/achievements")({
  component: AchievementsPage,
  // The unlock feed is the page. It comes out of our own achievement store
  // rather than Steam, so it answers in a few ms, and 100 unlocks is ~23 kB
  // that renders as ~100 rows — the payload is the content, not an aggregate.
  //
  // Which is also why it stays fatal rather than joining the tolerated primes
  // (see `primeQuietly`): the component below handles its own `isError`, so
  // swallowing would render a heading, a link and nothing else at HTTP 200.
  // A 500 asks a crawler to come back instead of indexing that.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(recentUnlocksQueryOptions(FEED_LIMIT)),
  head: () =>
    routeMeta({
      title: "Achievements · Steam · vyoh.gg",
      description: "Recent Steam achievement unlocks on vyoh.gg.",
    }),
});

function AchievementsPage() {
  const { data, isPending, isError } = useRecentUnlocks(FEED_LIMIT);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">
          The running feed of recent unlocks across the library.
        </p>
        <Link
          to="/steam/achievements/signature"
          className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/80 transition-colors hover:text-foreground"
        >
          View signatures
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <RecentSection
        unlocks={data?.unlocks ?? []}
        isPending={isPending}
        isError={isError}
      />
    </div>
  );
}

interface SectionProps {
  unlocks: SteamRecentUnlock[];
  isPending: boolean;
  isError: boolean;
}

function RecentSection({ unlocks, isPending, isError }: SectionProps) {
  if (isPending) {
    return (
      <p
        className={`${EMPTY_FRAME_CLASS} px-6 py-12 text-center text-sm text-muted-foreground`}
      >
        Loading recent unlocks…
      </p>
    );
  }

  if (isError) {
    return (
      <p
        className={`${EMPTY_FRAME_CLASS} px-6 py-12 text-center text-sm text-destructive`}
      >
        Recent unlocks are unavailable right now.
      </p>
    );
  }

  if (unlocks.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyAchievementsIllustration />}
        title="No achievements unlocked yet"
        hint="Recent unlocks will appear here as the daily poller pulls them in."
      />
    );
  }

  const uniqueGames = new Set(unlocks.map((u) => u.appid)).size;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground/90">{unlocks.length}</span> unlock
        {unlocks.length === 1 ? "" : "s"} across{" "}
        <span className="font-medium text-foreground/90">{uniqueGames}</span> game
        {uniqueGames === 1 ? "" : "s"}.
      </p>
      <RecentUnlocksVirtual unlocks={unlocks} />
    </div>
  );
}
