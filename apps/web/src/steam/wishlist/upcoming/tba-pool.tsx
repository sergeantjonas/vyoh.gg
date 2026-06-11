import type { SteamWishlistItem } from "@vyoh/shared";
import { BandHeader } from "./band-header";

// The watching pile — titles with no committed date. Smallest tier, text-first
// frosted chips rather than art (§ Band size ramp): bare text directly over the
// Steam backdrop needs the one glass layer, so the chips are frosted. Recency
// order is set upstream by groupUpcoming.
export function TbaPool({ items }: { items: SteamWishlistItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <BandHeader title="Still TBA" count={items.length} unit="games" />
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.appid}>
            <a
              href={item.storeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-border bg-card/60 px-3 py-1 text-foreground text-sm outline-none backdrop-blur-sm transition hover:bg-card/80 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {item.name ?? `App ${item.appid}`}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
