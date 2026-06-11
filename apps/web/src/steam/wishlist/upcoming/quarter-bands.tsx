import { formatWishlistReleaseLabel } from "@/steam/wishlist/format";
import { BandHeader } from "./band-header";
import type { QuarterBand } from "./bucketing";
import { WishlistCapsule } from "./wishlist-capsule";

// Month- and quarter-precise titles beyond the calendar window, one bare band
// per (year, quarter), chronological. Denser capsule grid than the calendar —
// these are a secondary strip, so they read at a glance and don't animate
// (§ Motion beats: band tiles static).
export function QuarterBands({ bands }: { bands: QuarterBand[] }) {
  if (bands.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      {bands.map((band) => (
        <div key={`${band.year}-${band.quarter}`} className="flex flex-col gap-3">
          <BandHeader title={`Q${band.quarter} ${band.year}`} count={band.items.length} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {band.items.map((item) => (
              <WishlistCapsule
                key={item.appid}
                item={item}
                detail={formatWishlistReleaseLabel(item) ?? undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
