import { EmptyMatchesIllustration, EmptyState } from "@/components/empty-state";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import { routeMeta } from "@/lib/route-meta";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { QueueFilter } from "@/lol/_shared/queue/queue-filter";
import { MatchList } from "@/lol/matches/match-list";
import { MatchListSkeleton } from "@/lol/matches/match-list-skeleton";
import { useCachedMatches } from "@/lol/matches/use-matches";
import { Outlet, createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

export const Route = createFileRoute("/lol/$accountSlug/matches")({
  component: MatchesLayout,
  head: ({ params }) =>
    routeMeta({
      title: `Matches · ${params.accountSlug} · vyoh.gg`,
      description: `League of Legends match history for ${params.accountSlug} on vyoh.gg.`,
    }),
});

// Parent layout for /lol/$accountSlug/matches/*. Owns the list so that
// navigating into a $matchId panel does NOT unmount the list — virtualizer
// offset, scroll position, filter state, and useCachedMatches all persist.
// Child routes (`/`, `/$matchId`) render into the Outlet at the bottom; the
// $matchId child wraps its content in <SlidePanel> to overlay the list.
function MatchesLayout() {
  const { accountSlug } = Route.useParams();
  const { queue } = useSearch({ from: "/lol/$accountSlug" });
  const account = useAccountFromSlug(accountSlug);
  const matches = useCachedMatches(account, queue);
  const navigate = useNavigate();
  const queueIsFiltered = queue !== undefined;

  useEffect(() => {
    if (account) {
      document.title = `Matches · ${account.gameName}#${account.tagLine} · vyoh.gg`;
    }
  }, [account]);

  const flat = useMemo(
    () => matches.data?.pages.flatMap((p) => p.matches) ?? [],
    [matches.data?.pages]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <QueueFilter />
      </div>
      {matches.isPending && account && <MatchListSkeleton />}
      {matches.isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{matches.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => matches.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {flat.length > 0 && (
        <>
          <MatchList
            matches={flat}
            accountSlug={accountSlug}
            hasNextPage={matches.hasNextPage}
            fetchNextPage={matches.fetchNextPage}
            isFetchingNextPage={matches.isFetchingNextPage}
          />
          <div className="flex items-center justify-center gap-2 py-4 text-center text-xs text-muted-foreground">
            {matches.isFetchingNextPage ? (
              <>
                <Loader size={12} label="Loading more matches" />
                <span>{flat.length} loaded · loading more…</span>
              </>
            ) : matches.hasNextPage ? (
              <span>{flat.length} loaded · scroll for more</span>
            ) : (
              <span>Showing all {flat.length} matches</span>
            )}
          </div>
        </>
      )}
      {!matches.isPending && !matches.isError && flat.length === 0 && (
        <EmptyState
          illustration={<EmptyMatchesIllustration />}
          title={queueIsFiltered ? "No matches in this queue" : "No matches cached yet"}
          hint={
            queueIsFiltered
              ? "Try a different queue or clear the filter."
              : "The background sync runs every 5 minutes — check back shortly, or hit refresh."
          }
          action={
            queueIsFiltered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    to: ".",
                    search: (prev) => {
                      const { queue: _, ...rest } = prev;
                      return rest;
                    },
                  })
                }
              >
                Clear queue filter
              </Button>
            ) : undefined
          }
        />
      )}
      <Outlet />
    </div>
  );
}
