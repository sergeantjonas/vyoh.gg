import { ForeverGamesChip } from "@/steam/forever-games-chip";
import { LibraryCompositionChip } from "@/steam/library-composition-chip";
import { PlatformMixChip } from "@/steam/platform-mix-chip";
import { WishlistChip } from "@/steam/wishlist-chip";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/")({
  component: SteamPage,
});

function SteamPage() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <WishlistChip />
      <LibraryCompositionChip />
      <ForeverGamesChip />
      <PlatformMixChip />
    </div>
  );
}
