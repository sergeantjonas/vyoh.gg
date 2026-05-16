import { LibraryCompositionChip } from "@/steam/library-composition-chip";
import { NowPlayingChip } from "@/steam/now-playing-chip";
import { OwnedGamesChip } from "@/steam/owned-games-chip";
import { PlatformMixChip } from "@/steam/platform-mix-chip";
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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Steam account at a glance — library size, playtime, platform mix, and wishlist.
        </p>
      </div>
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
