import { LibraryCompositionChip } from "@/steam/library-composition-chip";
import { NowPlayingChip } from "@/steam/now-playing-chip";
import { OwnedGamesChip } from "@/steam/owned-games-chip";
import { PlatformMixChip } from "@/steam/platform-mix-chip";
import { SteamIdentityHero } from "@/steam/profile/steam-identity-hero";
import { TrophyCaseStrip } from "@/steam/profile/trophy-case-strip";
import { RecentUnlocksChip } from "@/steam/recent-unlocks-chip";
import { WishlistChip } from "@/steam/wishlist-chip";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/")({
  component: SteamPage,
});

function SteamPage() {
  return (
    <div className="flex flex-col gap-6">
      <SteamIdentityHero />
      <NowPlayingChip />
      <TrophyCaseStrip />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RecentUnlocksChip />
        <WishlistChip />
        <LibraryCompositionChip />
        <OwnedGamesChip />
        <PlatformMixChip />
      </div>
    </div>
  );
}
