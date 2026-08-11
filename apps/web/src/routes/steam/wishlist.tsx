import { routeMeta } from "@/lib/route-meta";
import { steamWishlistQueryOptions } from "@/steam/use-wishlist";
import { WishlistAllPanel } from "@/steam/wishlist/wishlist-all-panel";
import { WishlistSkeleton } from "@/steam/wishlist/wishlist-skeleton";
import { createFileRoute, redirect } from "@tanstack/react-router";

interface WishlistSearch {
  appid?: number | undefined;
  // Legacy. This route used to carry both views behind `?tab=`, and those URLs
  // are bookmarkable and were emitted by the ⌘K palette. The param is parsed
  // only so `beforeLoad` can forward the Upcoming half to the route that owns
  // it now; nothing renders off it.
  tab?: "upcoming" | "all" | undefined;
}

export const Route = createFileRoute("/steam/wishlist")({
  component: WishlistPage,
  // Same reasoning as the matches route: a layout-shaped skeleton beats the
  // router's generic spinner, and only the slow client-navigation path sees it.
  pendingComponent: WishlistSkeleton,
  // Declared above `loader`: TanStack threads the loader's context type through
  // the beforeLoad return constraint, and in the other order that constraint
  // collapses to `never` ("Promise<void> is not assignable to never").
  beforeLoad: async ({ search }) => {
    // `replace` so Back leaves the calendar for wherever the visitor came from
    // rather than landing on the old URL and bouncing forward again.
    if (search.tab === "upcoming") {
      throw redirect({ to: "/steam/upcoming", replace: true });
    }
  },
  // Deliberately fatal, unlike the tolerated primes elsewhere (see
  // `primeQuietly`). The panel does carry an `isError` EmptyState, so swallowing
  // would render — but it would render an empty page at HTTP 200, which is a
  // worse thing to hand a crawler than a 500 asking it to retry. The list is not
  // a region of this route, it is the route.
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(steamWishlistQueryOptions()),
  validateSearch: (search: Record<string, unknown>): WishlistSearch => {
    const raw = search.appid;
    const parsed =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseInt(raw, 10)
          : Number.NaN;
    return {
      appid: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
      // `all` is kept out: it named this route's own list, so an old link
      // carrying it is already where it was going.
      tab: search.tab === "upcoming" ? "upcoming" : undefined,
    };
  },
  head: () =>
    routeMeta({
      title: "Wishlist · Steam · vyoh.gg",
      description: "Steam wishlist on vyoh.gg.",
    }),
});

function WishlistPage() {
  const { appid: focusAppid } = Route.useSearch();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Everything on the public Steam wishlist, oldest addition first — what's still
          unreleased has its own timeline under Upcoming.
        </p>
      </header>

      <WishlistAllPanel focusAppid={focusAppid} />
    </div>
  );
}
