import { CalendarClock } from "lucide-react";

// Interim placeholder. Chunk 3 replaces this with the upcoming-releases
// editorial (imminent hero, month calendar, quarter/year bands, TBA pool) per
// docs/working-notes/steam/wishlist-upcoming.md § Upcoming view composition.
// Until then `All` stays the default tab (the default-flip to `Upcoming` lands
// atomically with the real composition) so the live surface never defaults to a
// placeholder.
export function WishlistUpcomingPanel() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center backdrop-blur-sm">
      <CalendarClock className="size-8 text-muted-foreground/70" aria-hidden />
      <p className="text-sm font-medium text-foreground">Upcoming releases view</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        A calendar of what&rsquo;s coming up — sorted by how firmly Steam has dated each
        release. Being built now; the full wishlist lives under the{" "}
        <span className="font-medium text-foreground">All</span> tab.
      </p>
    </div>
  );
}
