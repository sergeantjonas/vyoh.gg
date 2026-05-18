import { cn } from "@/lib/utils";
import { steamCapsuleUrl } from "@/steam/_shared/steam-image";
import { useSteamWishlist } from "@/steam/use-wishlist";
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

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Brussels",
});

function formatDateAdded(epochSeconds: number): string {
  return DATE_FORMATTER.format(new Date(epochSeconds * 1_000));
}

function formatReleaseLabel(item: SteamWishlistItem): string | null {
  // For coming-soon titles Steam's `steam_release_date` is usually a placeholder
  // (Dec 31 of the target year for "later this year", quarter-end dates for
  // "Q3 2026", etc.) — claiming month precision would lie about a value Steam
  // itself doesn't commit to. Surface year only when comingSoon is true.
  if (item.comingSoon) {
    return item.releaseDate !== null
      ? `Coming ${new Date(item.releaseDate * 1_000).getUTCFullYear()}`
      : "Coming soon";
  }
  if (item.releaseDate !== null) {
    return `Released ${new Date(item.releaseDate * 1_000).getUTCFullYear()}`;
  }
  return null;
}

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
  return (
    <li
      data-appid={item.appid}
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition",
        isHighlighted && "ring-2 ring-amber-300 ring-offset-2 ring-offset-background"
      )}
    >
      <img
        src={steamCapsuleUrl(item.appid)}
        alt=""
        width={120}
        height={45}
        loading="lazy"
        className="h-11.25 w-30 flex-none rounded-sm bg-muted object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-base font-medium text-foreground/90">
          {item.name ?? `Unknown title (app ${item.appid})`}
        </p>
        <span className="text-sm text-muted-foreground">
          Added {formatDateAdded(item.dateAdded)}
          {(() => {
            const release = formatReleaseLabel(item);
            return release ? (
              <>
                {" · "}
                <span className={item.comingSoon ? "text-amber-200/80" : undefined}>
                  {release}
                </span>
              </>
            ) : null;
          })()}
        </span>
      </div>
      <a
        href={item.storeUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/40 bg-background/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background/70 hover:text-foreground"
      >
        View on Steam
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </li>
  );
}
