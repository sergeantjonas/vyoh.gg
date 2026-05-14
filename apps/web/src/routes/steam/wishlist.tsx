import { useSteamWishlist } from "@/steam/use-wishlist";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { SteamWishlistItem } from "@vyoh/shared";
import { useMemo } from "react";

export const Route = createFileRoute("/steam/wishlist")({
  component: WishlistPage,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Brussels",
});

function formatDateAdded(epochSeconds: number): string {
  return DATE_FORMATTER.format(new Date(epochSeconds * 1_000));
}

function WishlistPage() {
  const { data, isPending, isError } = useSteamWishlist();

  // Oldest first — the "this has been waiting since 2016" framing is the
  // backlog narrative the chip promises. Steam's `priority` field is opaque
  // remnant metadata and isn't a useful sort signal.
  const items = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => a.dateAdded - b.dateAdded);
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
          <Link to="/steam" className="hover:underline">
            Steam
          </Link>{" "}
          · Wishlist
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Public Steam wishlist — date added is from when the title first joined the
          backlog.
        </p>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading wishlist…</p>}

      {isError && (
        <p className="text-sm text-destructive">Wishlist is unavailable right now.</p>
      )}

      {data && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing on the wishlist right now.
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border/40 rounded-lg border bg-card/50">
          {items.map((item) => (
            <WishlistRow key={item.appid} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function WishlistRow({ item }: { item: SteamWishlistItem }) {
  return (
    <li className="flex flex-col gap-0.5 px-4 py-3">
      <a
        href={item.storeUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium underline-offset-2 hover:underline"
      >
        {item.name ?? `Unknown title (app ${item.appid})`}
      </a>
      <span className="text-xs text-muted-foreground">
        Added {formatDateAdded(item.dateAdded)}
      </span>
    </li>
  );
}
