import { EmptyState, EmptyWishlistIllustration } from "@/components/empty-state";
import { groupUpcoming, pickImminentRelease } from "@/steam/upcoming/bucketing";
import { ImminentHero } from "@/steam/upcoming/imminent-hero";
import { QuarterBands } from "@/steam/upcoming/quarter-bands";
import { ReleaseCalendar } from "@/steam/upcoming/release-calendar";
import { TbaPool } from "@/steam/upcoming/tba-pool";
import { UpcomingSkeleton } from "@/steam/upcoming/upcoming-skeleton";
import { YearBands } from "@/steam/upcoming/year-bands";
import { useSteamUpcoming } from "@/steam/use-upcoming";
import { useMemo } from "react";

// The upcoming-releases editorial (§ Upcoming view composition): a pipeline of
// what's coming when, certainty mapping to prominence — calendar for day-precise,
// quarter/year bands for coarser dates, the TBA pile last, imminent hero above
// the calendar. Reads the merged upcoming set, not the wishlist: a pre-ordered
// game leaves the wishlist at purchase, and dropping the nearest release from the
// calendar the moment the owner commits to it is the bug this endpoint exists for.
export function UpcomingPanel() {
  const { data, isPending, isError } = useSteamUpcoming();
  // One "now" per mount so the calendar and bucketing agree on today.
  const now = useMemo(() => new Date(), []);
  const buckets = useMemo(
    () => (data ? groupUpcoming(data.items, now) : null),
    [data, now]
  );

  if (isPending) return <UpcomingSkeleton />;

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Upcoming releases are unavailable right now.
      </p>
    );
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
        hint="Nothing wishlisted or pre-ordered is still unreleased — the Wishlist tab has everything that's already out."
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
        <ReleaseCalendar dayReleases={buckets.dayReleases} now={now} />
      ) : null}
      <QuarterBands bands={buckets.quarterBands} />
      <YearBands bands={buckets.yearBands} />
      <TbaPool items={buckets.tba} />
    </div>
  );
}
