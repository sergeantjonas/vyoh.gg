import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FactCard } from "./_shared/fact-card";
import { FactCardData } from "./_shared/fact-card-data";
import { steamCapsuleLargeUrl } from "./_shared/steam-image";
import { formatUpcomingFact, pickUpcomingFact } from "./upcoming/upcoming-fact";
import { useSteamUpcoming } from "./use-upcoming";

// The forward-looking half of the wishlist pair, and the reason the two are
// separate cards: this one counts and names things the wishlist does not hold.
// A pre-ordered game leaves the wishlist at purchase and is exactly the release
// most likely to be nearest, so a card titled Wishlist naming it was making a
// claim its own count contradicted.
//
// "On the radar" rather than "Upcoming" (the route's name) or a countdown
// framing: the chip's weakest tier is a title with no date at all, and a game
// nobody has dated is still on the radar while it is neither counting down nor
// in a launch window.
export function UpcomingChip() {
  const query = useSteamUpcoming();
  // One "now" per mount so the fact picker reads a stable today.
  const now = useMemo(() => new Date(), []);

  return (
    <FactCardData
      query={query}
      title="On the radar"
      pendingLabel="Loading upcoming releases…"
      errorLabel="Upcoming releases are unavailable right now."
      emptyLabel="Nothing unreleased is being tracked."
      emptyPrescription="Wishlist something unreleased, or pre-order it."
      isEmpty={(data) => data.items.length === 0}
    >
      {(data) => {
        const fact = pickUpcomingFact(data.items, now);
        return (
          <FactCard
            title="On the radar"
            metric={data.items.length}
            metricLabel={{ singular: "release", plural: "releases" }}
            // Every tier of the picker needs a date or a TBA title to speak; with
            // neither, the honest line is the horizon it just failed to fill.
            verdict={
              fact ? formatUpcomingFact(fact) : "Nothing lands in the next 90 days."
            }
            evidence={
              <div className="flex flex-col gap-2">
                {fact ? (
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
                ) : null}
                <Link
                  to="/steam/upcoming"
                  className="text-sm text-foreground/70 underline-offset-2 hover:underline"
                >
                  See the timeline →
                </Link>
              </div>
            }
          />
        );
      }}
    </FactCardData>
  );
}
