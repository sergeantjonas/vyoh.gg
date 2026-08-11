import { formatWishlistReleaseLabel } from "@/steam/wishlist/format";
import { BandHeader } from "./band-header";
import type { YearBand } from "./bucketing";
import { ReleaseCapsule } from "./release-capsule";

// Year-precise titles, one bare band per year, ascending. Smaller capsule grid
// than the quarter bands (more columns) — the temporal-certainty ramp means the
// least precisely dated tier gets the least art (§ Band size ramp).
export function YearBands({ bands }: { bands: YearBand[] }) {
  if (bands.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      {bands.map((band) => (
        <div key={band.year} className="flex flex-col gap-3">
          <BandHeader title={String(band.year)} count={band.items.length} />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {band.items.map((item) => (
              <ReleaseCapsule
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
