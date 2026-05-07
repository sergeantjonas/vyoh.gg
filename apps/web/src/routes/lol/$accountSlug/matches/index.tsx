import { Button } from "@/components/ui/button";
import { useAccountFromSlug } from "@/identity/use-account-from-slug";
import { useHoverChampion } from "@/lol/hover-champion-context";
import { MatchList } from "@/lol/match-list";
import { MatchListSkeleton } from "@/lol/match-list-skeleton";
import { useMatches } from "@/lol/use-matches";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

export const Route = createFileRoute("/lol/$accountSlug/matches/")({
  component: MatchesPage,
});

function MatchesPage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const matches = useMatches(account);

  const flat = useMemo(() => matches.data?.pages.flat() ?? [], [matches.data?.pages]);

  const setHoveredChampion = useHoverChampion();

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !matches.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !matches.isFetchingNextPage) {
          matches.fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [matches.hasNextPage, matches.isFetchingNextPage, matches.fetchNextPage]);

  return (
    <div className="flex flex-col gap-4">
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
        <MatchList
          matches={flat}
          accountSlug={accountSlug}
          onCardHover={setHoveredChampion ?? undefined}
        />
      )}

      {matches.hasNextPage && (
        <div ref={sentinelRef} className="flex items-center justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => matches.fetchNextPage()}
            disabled={matches.isFetchingNextPage}
          >
            {matches.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
