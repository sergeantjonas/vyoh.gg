import { routeMeta } from "@/lib/route-meta";
import { OwnedGamesChip } from "@/steam/owned-games-chip";
import { SteamIdentityHero } from "@/steam/profile/steam-identity-hero";
import { TrophyCaseStrip } from "@/steam/profile/trophy-case-strip";
import { RecentUnlocksChip } from "@/steam/recent-unlocks-chip";
import { UpcomingChip } from "@/steam/upcoming-chip";
import { WishlistChip } from "@/steam/wishlist-chip";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/")({
  component: SteamPage,
  // No loader. What is left on this page is identity and counts, each chip
  // owning its own query and its own pending state; the two endpoints that
  // were primed here moved to /steam/portrait with the sections that read
  // them. Priming them anyway would put 3.8 kB into every profile document to
  // warm a cache the page never touches.
  head: () =>
    routeMeta({
      title: "Steam profile · vyoh.gg",
      description:
        "Steam identity, trophy case, recent unlocks, and library mix on vyoh.gg.",
    }),
});

function SteamPage() {
  return (
    // Sections need more air between them than their own parts need inside
    // them, or the band header reads as belonging to the band above it.
    <div className="flex flex-col gap-12">
      <SteamIdentityHero />
      <TrophyCaseStrip />
      {/* Paired by tense on the wide tier: the two-column row reads recent
          unlocks beside what lands next, then the backlog beside the library. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RecentUnlocksChip />
        <UpcomingChip />
        <WishlistChip />
        <OwnedGamesChip />
      </div>
    </div>
  );
}
