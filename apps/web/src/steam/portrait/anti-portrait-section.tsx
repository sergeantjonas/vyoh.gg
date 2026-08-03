import { SectionTitle } from "@/components/ui/section-title";
import { AntiPortraitHero } from "./anti-portrait-hero";
import { BounceGenresCard } from "./bounce-genres-card";
import { ChipBand } from "./chip-band";
import { ColdestShelfCard } from "./coldest-shelf-card";
import { QuickestAbandonsCard } from "./quickest-abandons-card";
import { SingleAchievementCard } from "./single-achievement-card";
import { TastedTierCard } from "./tasted-tier-card";

// The counterweight to PortraitSection, and the reason the page is worth
// reading: Steam itself only ever surfaces what you played most. Same bare
// wrapper and chromed children as its twin.
export function AntiPortraitSection() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle as="h2">Anti-Portrait</SectionTitle>
        <p className="text-muted-foreground/70 text-xs">
          The half Steam doesn't show you
        </p>
      </div>
      <AntiPortraitHero />
      {/* Ordered so a row isn't set by one outlier: the three cards that carry
          a claim share the first row, the two that carry a four-row list share
          the second. Mixed, the list cards make their neighbours twice as tall
          as their own content needs. */}
      <ChipBand>
        <TastedTierCard />
        <ColdestShelfCard />
        <BounceGenresCard />
        <QuickestAbandonsCard />
        <SingleAchievementCard />
      </ChipBand>
    </section>
  );
}
