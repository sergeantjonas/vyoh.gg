import { EmptyMatchesIllustration, EmptyState } from "@/components/empty-state";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import { meQueryOptions } from "@/identity/use-me";
import { routeMeta } from "@/lib/route-meta";
import { findAccountBySlug } from "@/lol/_shared/account/find-account-by-slug";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { QueueFilter } from "@/lol/_shared/queue/queue-filter";
import { MatchList } from "@/lol/matches/match-list";
import { MatchListSkeleton } from "@/lol/matches/match-list-skeleton";
import {
  cachedMatchesInfiniteQueryOptions,
  useCachedMatches,
} from "@/lol/matches/use-matches";
import { Outlet, createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

export const Route = createFileRoute("/lol/$accountSlug/matches")({
  component: MatchesLayout,
  // Overrides the router's generic pending spinner: this route has a skeleton
  // that mirrors its own layout, which is the bar the convention sets. Only
  // reached when the loader below is still running a second after a client
  // navigation — a server render has already awaited it.
  pendingComponent: MatchListSkeleton,
  // The match list is this route's entire content, and one page of it is 20
  // matches / ~25 kB that render almost 1:1 into rows — the payload is the page
  // rather than an aggregate the page reduces. It answers in single-digit ms
  // because it reads our own match cache rather than Riot, so it can sit in the
  // document's critical path without moving TTFB.
  //
  // Only the unfiltered view is primed. `?queue=` is a filter the owner reaches
  // for, not a URL anything links to, so it renders client-side like any other
  // interaction.
  //
  // Deliberately fatal, unlike the tolerated primes elsewhere (see
  // `primeQuietly`). The layout below does handle its own error state, so
  // swallowing would render — but a match history with no matches in it is not
  // a page worth answering 200 for. The list is the route, not a region of it.
  loader: async ({ context: { queryClient }, params }) => {
    const me = await queryClient.ensureQueryData(meQueryOptions());
    const account = findAccountBySlug(me.lol, params.accountSlug);
    if (!account) return;
    await queryClient.ensureInfiniteQueryData(cachedMatchesInfiniteQueryOptions(account));
  },
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
