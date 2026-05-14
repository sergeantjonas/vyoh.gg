import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import { Link } from "@tanstack/react-router";
import { useSteamWishlist } from "./use-wishlist";

export function WishlistChip() {
  const { data, isPending, isError } = useSteamWishlist();

  if (isPending) {
    return (
      <ConclusionCard title="Wishlist" sampleSize={0} verdict="Loading wishlist…" empty />
    );
  }

  if (isError || !data) {
    return (
      <ConclusionCard
        title="Wishlist"
        sampleSize={0}
        verdict="Wishlist is unavailable right now."
        empty
      />
    );
  }

  const count = data.items.length;
  const verdict =
    count === 0
      ? "Nothing on the wishlist right now."
      : `${count} ${count === 1 ? "game" : "games"} waiting in the backlog.`;

  return (
    <ConclusionCard
      title="Wishlist"
      sampleSize={count}
      verdict={verdict}
      empty={count === 0}
      evidence={
        count > 0 ? (
          <Link
            to="/steam/wishlist"
            className="text-sm text-foreground/70 underline-offset-2 hover:underline"
          >
            See the full list →
          </Link>
        ) : undefined
      }
    />
  );
}
