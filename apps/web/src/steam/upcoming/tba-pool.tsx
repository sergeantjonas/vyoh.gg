import { HiddenNote } from "@/steam/curation/hidden-mark";
import { useGameCuration } from "@/steam/curation/use-game-curation";
import { isPreOrdered } from "@/steam/upcoming/bucketing";
import { PreOrderedNote } from "@/steam/upcoming/pre-ordered-mark";
import type { SteamUpcomingItem } from "@vyoh/shared";
import { BandHeader } from "./band-header";

// The watching pile — titles with no committed date. Smallest tier, text-first
// frosted chips rather than art (§ Band size ramp): bare text directly over the
// Steam backdrop needs the one glass layer, so the chips are frosted. Recency
// order is set upstream by groupUpcoming.
export function TbaPool({ items }: { items: SteamUpcomingItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <BandHeader title="Still TBA" count={items.length} unit="games" />
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <TbaChip key={item.appid} item={item} />
        ))}
      </ul>
    </section>
  );
}

// Its own component because the curation lookup is a hook, and a hook cannot be
// called from inside the map above.
function TbaChip({ item }: { item: SteamUpcomingItem }) {
  const { hidden } = useGameCuration(item.appid);
  const name = item.name ?? `App ${item.appid}`;

  return (
    <li>
      <a
        href={item.storeUrl}
        target="_blank"
        rel="noreferrer"
        // Spelled out rather than left to the marker glyph: the chip's own text
        // is the accessible name, so without this a screen-reader user hears
        // the title and nothing about who can see it.
        aria-label={hidden ? `${name} on Steam — hidden from visitors` : undefined}
        className="inline-flex items-center rounded-full border border-border bg-card/60 px-3 py-1 text-foreground text-sm outline-none backdrop-blur-sm transition hover:bg-card/80 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {name}
        {isPreOrdered(item) ? <PreOrderedNote /> : null}
        {hidden ? <HiddenNote /> : null}
      </a>
    </li>
  );
}
