import { EmptyState, EmptyWishlistIllustration } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { SteamGameRowShell } from "@/steam/_shared/steam-game-row";
import { HideGameButton } from "@/steam/curation/hide-game-button";
import { useSteamWishlist } from "@/steam/use-wishlist";
import {
  formatWishlistDateAdded,
  formatWishlistReleaseLabel,
} from "@/steam/wishlist/format";
import { WishlistSkeleton } from "@/steam/wishlist/wishlist-skeleton";
import type { SteamWishlistItem } from "@vyoh/shared";
import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface WishlistAllPanelProps {
  // Deep-link target from the profile chip (?appid=<id>). When present the
  // matching row is scrolled into view and briefly highlighted.
  focusAppid: number | undefined;
}

export function WishlistAllPanel({ focusAppid }: WishlistAllPanelProps) {
  const { data, isPending, isError } = useSteamWishlist();
  const listRef = useRef<HTMLUListElement>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);

  // Oldest first — the "this has been waiting since 2016" framing is the
  // backlog narrative the chip promises. Steam's `priority` field is opaque
  // remnant metadata and isn't a useful sort signal.
  const items = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => a.dateAdded - b.dateAdded);
  }, [data]);

  // Mirror the achievement-panel pattern: arm `highlighted` once the row is
  // present, then a separate effect handles scroll + auto-fade.
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

  if (isPending) return <WishlistSkeleton />;

  if (isError) {
    return <p className="text-sm text-destructive">Wishlist is unavailable right now.</p>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyWishlistIllustration />}
        title="Nothing on the wishlist right now"
        hint="Public Steam wishlist additions show up here after the next sync."
      />
    );
  }

  return (
    <ul ref={listRef} className="flex flex-col gap-2">
      {items.map((item) => (
        <WishlistRow
          key={item.appid}
          item={item}
          isHighlighted={highlighted === item.appid}
        />
      ))}
    </ul>
  );
}

interface WishlistRowProps {
  item: SteamWishlistItem;
  isHighlighted: boolean;
}

function WishlistRow({ item, isHighlighted }: WishlistRowProps) {
  const release = formatWishlistReleaseLabel(item);
  return (
    // Flex, so the owner's hide toggle can be a *sibling* of the anchor rather
    // than a descendant of it. A button inside a link is invalid HTML and a
    // nested-interactive a11y failure — the library surfaces dodge that by
    // living in a hovercard, and a wishlist row has none to hide in.
    //
    // `items-center`, not `items-stretch`: the toggle's flex item is its tooltip
    // trigger, and a stretched trigger is a row-tall anchor box, which throws
    // the hint a full row clear of the button.
    <li data-appid={item.appid} className="flex items-center gap-2">
      <a
        href={item.storeUrl}
        target="_blank"
        rel="noreferrer"
        // External nav: no view-transition morph (the destination is the
        // Steam store, not a /steam/library route). The whole row is the click
        // target; the trailing icon is a visual external-link affordance.
        className={cn(
          "group/row min-w-0 flex-1 rounded-lg outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
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
      {/* `name` matters more here than on the library surfaces: a wishlisted
          game usually has no owned-game row for the api to take a label from. */}
      <HideGameButton appid={item.appid} name={item.name} compact className="shrink-0" />
    </li>
  );
}
