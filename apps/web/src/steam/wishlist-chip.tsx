import { Link } from "@tanstack/react-router";
import { FactCard } from "./_shared/fact-card";
import { steamCapsuleUrl } from "./_shared/steam-image";
import { useSteamWishlist } from "./use-wishlist";

const PREVIEW_LIMIT = 5;

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: "Europe/Brussels",
});

function shortDateAdded(epochSeconds: number): string {
  return SHORT_DATE.format(new Date(epochSeconds * 1_000));
}

export function WishlistChip() {
  const { data, isPending, isError } = useSteamWishlist();

  if (isPending) {
    return <FactCard title="Wishlist" verdict="Loading wishlist…" empty />;
  }

  if (isError || !data) {
    return (
      <FactCard title="Wishlist" verdict="Wishlist is unavailable right now." empty />
    );
  }

  // Oldest-first matches the destination route at /steam/wishlist — the chip
  // exists to surface the backlog-age narrative, not to celebrate recent
  // additions.
  const sorted = [...data.items].sort((a, b) => a.dateAdded - b.dateAdded);
  const [oldest] = sorted;
  if (!oldest) {
    return (
      <FactCard title="Wishlist" verdict="Nothing on the wishlist right now." empty />
    );
  }

  const count = data.items.length;
  const preview = sorted.slice(0, PREVIEW_LIMIT);
  const oldestYear = new Date(oldest.dateAdded * 1_000).getUTCFullYear();
  const verdict = oldest.name
    ? `Oldest entry: ${oldest.name} (${oldestYear}).`
    : `Oldest entry has been waiting since ${oldestYear}.`;

  return (
    <FactCard
      title="Wishlist"
      metric={count}
      metricLabel={{ singular: "game", plural: "games" }}
      verdict={verdict}
      evidence={
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-1.5">
            {preview.map((item) => (
              <li key={item.appid}>
                <Link
                  to="/steam/wishlist"
                  search={{ appid: item.appid }}
                  className="flex items-center gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-background/40"
                >
                  <img
                    src={steamCapsuleUrl(item.appid)}
                    alt=""
                    width={96}
                    height={36}
                    loading="lazy"
                    className="h-9 w-24 shrink-0 rounded-sm bg-muted object-cover"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/90">
                    {item.name ?? `Unknown title (app ${item.appid})`}
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                    {shortDateAdded(item.dateAdded)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/steam/wishlist"
            className="text-sm text-foreground/70 underline-offset-2 hover:underline"
          >
            See the full list →
          </Link>
        </div>
      }
    />
  );
}
