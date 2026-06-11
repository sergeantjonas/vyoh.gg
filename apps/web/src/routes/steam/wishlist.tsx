import { routeMeta } from "@/lib/route-meta";
import { WishlistAllPanel } from "@/steam/wishlist/wishlist-all-panel";
import {
  type WishlistTab,
  WishlistTabs,
  isWishlistTab,
  wishlistPanelId,
  wishlistTabId,
} from "@/steam/wishlist/wishlist-tabs";
import { WishlistUpcomingPanel } from "@/steam/wishlist/wishlist-upcoming-panel";
import { createFileRoute } from "@tanstack/react-router";

interface WishlistSearch {
  appid?: number | undefined;
  tab?: WishlistTab | undefined;
}

export const Route = createFileRoute("/steam/wishlist")({
  component: WishlistPage,
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
      tab: isWishlistTab(search.tab) ? search.tab : undefined,
    };
  },
  head: () =>
    routeMeta({
      title: "Wishlist · Steam · vyoh.gg",
      description: "Steam wishlist on vyoh.gg.",
    }),
});

function WishlistPage() {
  const { appid: focusAppid, tab } = Route.useSearch();

  // Default is `Upcoming` — the editorial upcoming-releases view is now the
  // primary surface. A deep-link carrying `?appid` (the profile chip) with no
  // explicit tab still lands on `All`, where the row scroll+highlight lives.
  const activeTab: WishlistTab = tab ?? (focusAppid ? "all" : "upcoming");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Public Steam wishlist — upcoming releases on a timeline, plus everything still
          on the watch list.
        </p>
      </header>

      <WishlistTabs active={activeTab} />

      <div
        role="tabpanel"
        id={wishlistPanelId(activeTab)}
        aria-labelledby={wishlistTabId(activeTab)}
      >
        {activeTab === "upcoming" ? (
          <WishlistUpcomingPanel />
        ) : (
          <WishlistAllPanel focusAppid={focusAppid} />
        )}
      </div>
    </div>
  );
}
