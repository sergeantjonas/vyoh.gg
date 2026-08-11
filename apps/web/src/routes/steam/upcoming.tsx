import { routeMeta } from "@/lib/route-meta";
import { steamUpcomingQueryOptions } from "@/steam/use-upcoming";
import { UpcomingSkeleton } from "@/steam/wishlist/upcoming/upcoming-skeleton";
import { WishlistUpcomingPanel } from "@/steam/wishlist/wishlist-upcoming-panel";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/upcoming")({
  component: UpcomingPage,
  pendingComponent: UpcomingSkeleton,
  // Fatal, like the wishlist and achievement feeds: the timeline is the whole
  // route, so swallowing the prime would answer HTTP 200 over an EmptyState and
  // teach a crawler the page has nothing on it.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(steamUpcomingQueryOptions()),
  head: () =>
    routeMeta({
      title: "Upcoming · Steam · vyoh.gg",
      description: "Unreleased Steam games I'm tracking, on one timeline.",
    }),
});

function UpcomingPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Upcoming</h1>
        <p className="text-sm text-muted-foreground">
          Everything still unreleased that I'm tracking — wishlisted or already bought —
          from dated launches down to the year-unknown pile.
        </p>
      </header>

      <WishlistUpcomingPanel />
    </div>
  );
}
