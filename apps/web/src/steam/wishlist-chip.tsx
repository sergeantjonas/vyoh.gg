import { Link } from "@tanstack/react-router";
import { OWNER_TIME_ZONE } from "@vyoh/shared";
import { useMemo } from "react";
import { FactCard } from "./_shared/fact-card";
import { FactCardData } from "./_shared/fact-card-data";
import { steamCapsuleLargeUrl, steamCapsuleUrl } from "./_shared/steam-image";
import { useSteamUpcoming } from "./use-upcoming";
import { useSteamWishlist } from "./use-wishlist";
import { formatWishlistFact } from "./wishlist/format";
import { pickWishlistFact } from "./wishlist/wishlist-fact";

const PREVIEW_LIMIT = 5;

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: OWNER_TIME_ZONE,
});

function shortDateAdded(epochSeconds: number): string {
  return SHORT_DATE.format(new Date(epochSeconds * 1_000));
}

export function WishlistChip() {
  const query = useSteamWishlist();
  // Second query, because the card makes two different claims. The count and the
  // fallback list are about the wishlist and belong to the wishlist. The leading
  // fact is about what lands next, which a pre-order can win — and pre-orders are
  // not on the wishlist. Its pending/error states stay the wishlist's: the fact is
  // an enhancement, and the card is legible without it.
  const upcoming = useSteamUpcoming();
  // One "now" per mount so the fact picker reads a stable today.
  const now = useMemo(() => new Date(), []);

  return (
    <FactCardData
      query={query}
      title="Wishlist"
      pendingLabel="Loading wishlist…"
      errorLabel="Wishlist is unavailable right now."
      emptyLabel="Nothing on the wishlist right now."
      isEmpty={(data) => data.items.length === 0}
    >
      {(data) => {
        const count = data.items.length;

        // Lead with a forward-looking fact when one qualifies (§ Profile tile
        // reframe): a dated release within the horizon, or the longest-waiting
        // TBA title — a real piece of identity rather than a count. The count
        // stays as the quiet top-right indicator.
        const fact = pickWishlistFact(upcoming.data?.items ?? [], now);
        if (fact) {
          return (
            <FactCard
              title="Wishlist"
              metric={count}
              metricLabel={{ singular: "game", plural: "games" }}
              verdict={formatWishlistFact(fact)}
              evidence={
                <div className="flex flex-col gap-2">
                  {/* The fact is a release-date claim, so its evidence is the
                      timeline, not a row in the list — and a pre-ordered title
                      has no list row to deep-link to at all. */}
                  <Link
                    to="/steam/upcoming"
                    className="group block overflow-hidden rounded-md transition-opacity hover:opacity-95"
                  >
                    <img
                      src={steamCapsuleLargeUrl(fact.item.appid)}
                      alt={fact.item.name ?? `Upcoming app ${fact.item.appid}`}
                      width={460}
                      height={215}
                      loading="lazy"
                      className="aspect-[460/215] w-full rounded-md bg-muted object-cover"
                    />
                  </Link>
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

        // Fallback (§ Profile tile reframe tier 4): nothing dated within the
        // horizon and no TBA title — keep the backlog-age framing on the oldest
        // entry by dateAdded. Oldest-first matches the destination route.
        const sorted = [...data.items].sort((a, b) => a.dateAdded - b.dateAdded);
        const [oldest] = sorted;
        if (!oldest) return null;
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
      }}
    </FactCardData>
  );
}
