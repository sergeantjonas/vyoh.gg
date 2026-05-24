import { EmptyState, EmptyWishlistIllustration } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { SteamGameRowShell } from "@/steam/_shared/steam-game-row";
import { useSteamWishlist } from "@/steam/use-wishlist";
import {
  formatWishlistDateAdded,
  formatWishlistReleaseLabel,
} from "@/steam/wishlist/format";
import { WishlistSkeleton } from "@/steam/wishlist/wishlist-skeleton";
import { createFileRoute } from "@tanstack/react-router";
import type { SteamWishlistItem } from "@vyoh/shared";
import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface WishlistSearch {
  appid?: number | undefined;
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
    return { appid: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined };
  },
});

function WishlistPage() {
  const { data, isPending, isError } = useSteamWishlist();
  const { appid: focusAppid } = Route.useSearch();
  const listRef = useRef<HTMLUListElement>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);

  // Oldest first — the "this has been waiting since 2016" framing is the
  // backlog narrative the chip promises. Steam's `priority` field is opaque
  // remnant metadata and isn't a useful sort signal.
  const items = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => a.dateAdded - b.dateAdded);
  }, [data]);

  // Deep-link from the profile chip lands here with ?appid=<id>. Mirror the
  // achievement-panel pattern: arm `highlighted` once the row is present, then
  // a separate effect handles scroll + auto-fade.
  useEffect(() => {
    if (!focusAppid || items.length === 0) return;
    if (!items.some((i) => i.appid === focusAppid)) return;
    setHighlighted(focusAppid);
  }, [focusAppid, items]);

  useEffect(() => {
    if (highlighted === null || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-appid="${highlighted}"]`
    );
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setHighlighted(null), 2500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [highlighted]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Public Steam wishlist — date added is from when the title first joined the
          backlog.
        </p>
      </div>

      {isPending && <WishlistSkeleton />}

      {isError && (
        <p className="text-sm text-destructive">Wishlist is unavailable right now.</p>
      )}

      {data && items.length === 0 && (
        <EmptyState
          illustration={<EmptyWishlistIllustration />}
          title="Nothing on the wishlist right now"
          hint="Public Steam wishlist additions show up here after the next sync."
        />
      )}

      {items.length > 0 && (
        <ul ref={listRef} className="flex flex-col gap-2">
          {items.map((item) => (
            <WishlistRow
              key={item.appid}
              item={item}
              isHighlighted={highlighted === item.appid}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface WishlistRowProps {
  item: SteamWishlistItem;
  isHighlighted: boolean;
}

function WishlistRow({ item, isHighlighted }: WishlistRowProps) {
  const release = formatWishlistReleaseLabel(item);
  return (
    <li data-appid={item.appid}>
      <a
        href={item.storeUrl}
        target="_blank"
        rel="noreferrer"
        // External nav: no view-transition morph (the destination is the
        // Steam store, not a /steam/game route). The whole row is the click
        // target; the trailing icon is a visual external-link affordance.
        className={cn(
          "block rounded-lg outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
          isHighlighted && "ring-2 ring-amber-300 ring-offset-2 ring-offset-background"
        )}
        aria-label={`${item.name ?? `App ${item.appid}`} on Steam`}
      >
        <SteamGameRowShell
          appid={item.appid}
          name={item.name ?? `Unknown title (app ${item.appid})`}
          meta={
            <>
              Added {formatWishlistDateAdded(item.dateAdded)}
              {release ? (
                <>
                  {" · "}
                  <span className={item.comingSoon ? "text-amber-200/80" : undefined}>
                    {release}
                  </span>
                </>
              ) : null}
            </>
          }
          trailing={<ExternalLink className="size-4" aria-hidden />}
        />
      </a>
    </li>
  );
}
