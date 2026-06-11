import { EmptyState, EmptyWishlistIllustration } from "@/components/empty-state";
import { useSteamWishlist } from "@/steam/use-wishlist";
import { groupUpcoming, pickImminentRelease } from "@/steam/wishlist/upcoming/bucketing";
import { ImminentHero } from "@/steam/wishlist/upcoming/imminent-hero";
import { QuarterBands } from "@/steam/wishlist/upcoming/quarter-bands";
import { TbaPool } from "@/steam/wishlist/upcoming/tba-pool";
import { UpcomingSkeleton } from "@/steam/wishlist/upcoming/upcoming-skeleton";
import { WishlistCalendar } from "@/steam/wishlist/upcoming/wishlist-calendar";
import { YearBands } from "@/steam/wishlist/upcoming/year-bands";
import { useMemo } from "react";

// The upcoming-releases editorial (§ Upcoming view composition): the wishlist
// reframed as a pipeline of what's coming when, certainty mapping to prominence
// — calendar for day-precise, quarter/year bands for coarser dates, the TBA
// pile last. The imminent hero (chunk 4) slots in above the calendar.
export function WishlistUpcomingPanel() {
  const { data, isPending, isError } = useSteamWishlist();
  // One "now" per mount so the calendar and bucketing agree on today.
  const now = useMemo(() => new Date(), []);
  const buckets = useMemo(
    () => (data ? groupUpcoming(data.items, now) : null),
    [data, now]
  );

  if (isPending) return <UpcomingSkeleton />;

  if (isError) {
    return <p className="text-destructive text-sm">Wishlist is unavailable right now.</p>;
  }

  const isEmpty =
    !buckets ||
    (buckets.dayReleases.length === 0 &&
      buckets.quarterBands.length === 0 &&
      buckets.yearBands.length === 0 &&
      buckets.tba.length === 0);

  if (isEmpty) {
    return (
      <EmptyState
        illustration={<EmptyWishlistIllustration />}
        title="Nothing on the horizon"
        hint="No dated or upcoming releases on the wishlist right now — browse everything under the All tab."
      />
    );
  }

  // The imminent hero (§ Art direction) — nearest day-precise release inside
  // the ~60-day horizon, or null. Skipped cleanly when nothing qualifies; the
  // page then leads with the calendar, the documented hero-skip fallback.
  const imminent = pickImminentRelease(buckets.dayReleases);

  return (
    <div className="flex flex-col gap-10">
      {imminent ? <ImminentHero key={imminent.item.appid} release={imminent} /> : null}
      {/* Sparse-state rule (§ Month calendar): only render the calendar when
          there are day-precise releases to populate it — pickCalendarAnchor
          shifts the window to wherever they are, so it's never an empty grid.
          With none, the bands lead the page. */}
      {buckets.dayReleases.length > 0 ? (
        <WishlistCalendar dayReleases={buckets.dayReleases} now={now} />
      ) : null}
      <QuarterBands bands={buckets.quarterBands} />
      <YearBands bands={buckets.yearBands} />
      <TbaPool items={buckets.tba} />
    </div>
  );
}
