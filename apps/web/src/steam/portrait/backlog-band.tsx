import { SectionTitle } from "@/components/ui/section-title";

import { ChipBand } from "./chip-band";
import { PickUpNextCard } from "./pick-up-next-card";
import { SleepingGenreCard } from "./sleeping-genre-card";
import { WorthReopeningCard } from "./worth-reopening-card";

// The turn between the two halves, and the only part of the page that asks for
// something back. Position does the bridging — the Portrait establishes what
// the owner plays, this points it at the shelf, and the Anti-Portrait then
// explains why the shelf is that long — so the band carries no hero of its own.
// A third masthead would make the page read as three essays instead of one.
export function BacklogBand() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle as="h2">What to play</SectionTitle>
        <p className="text-muted-foreground/70 text-xs">
          Your own shelf, scored against the portrait
        </p>
      </div>
      {/* Three cards of near-identical weight, so they share one row rather
          than resolving through a two-column step that strands the third. */}
      <ChipBand columns="3-up">
        <PickUpNextCard />
        <SleepingGenreCard />
        <WorthReopeningCard />
      </ChipBand>
    </section>
  );
}
