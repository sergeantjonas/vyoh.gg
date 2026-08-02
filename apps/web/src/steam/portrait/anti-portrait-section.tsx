import { SectionTitle } from "@/components/ui/section-title";
import { BounceGenresCard } from "./bounce-genres-card";
import { ColdestShelfCard } from "./coldest-shelf-card";
import { QuickestAbandonsCard } from "./quickest-abandons-card";
import { SingleAchievementCard } from "./single-achievement-card";
import { TastedTierCard } from "./tasted-tier-card";
import { TheGapCard } from "./the-gap-card";

// The counterweight to PortraitSection, and the reason the page is worth
// reading: Steam itself only ever surfaces what you played most. Same bare
// wrapper and chromed children as its twin.
export function AntiPortraitSection() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle as="h2">Anti-Portrait</SectionTitle>
        <p className="text-muted-foreground/70 text-xs">
          The half Steam doesn't show you
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TastedTierCard />
        <QuickestAbandonsCard />
        <BounceGenresCard />
        <SingleAchievementCard />
        <ColdestShelfCard />
        <TheGapCard />
      </div>
    </section>
  );
}
