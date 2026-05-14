import { WishlistChip } from "@/steam/wishlist-chip";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/")({
  component: SteamPage,
});

function SteamPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Steam</h1>
        <p className="text-sm text-muted-foreground">
          Steam integration is taking shape. Wishlist is live; recent activity, playtime,
          and achievements land in upcoming phases.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <WishlistChip />
      </div>
    </div>
  );
}
