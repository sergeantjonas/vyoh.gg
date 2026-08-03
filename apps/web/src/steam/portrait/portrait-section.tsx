import { SectionTitle } from "@/components/ui/section-title";
import { ChipBand } from "./chip-band";
import { CompletionistCard } from "./completionist-card";
import { LibraryPostureCard } from "./library-posture-card";
import { PlatformIdentityCard } from "./platform-identity-card";
import { PortraitHero } from "./portrait-hero";
import { RecentDriftCard } from "./recent-drift-card";

// Bare wrapper, chromed children: each card carries its own frosted shell, so
// wrapping the band would nest chrome inside chrome. The header does the
// dividing work instead — see the chrome-composition rule in
// docs/repo-conventions.md.
export function PortraitSection() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle as="h2">Portrait</SectionTitle>
        {/* Steam's Web API exposes no publisher genre, so the whole genre half
            of this section is inferred. Saying so is load-bearing for a page
            whose pitch is being honest about its own data. */}
        <p className="text-muted-foreground/70 text-xs">
          Genres derived from community tags
        </p>
      </div>
      <PortraitHero />
      <ChipBand columns={2}>
        <RecentDriftCard />
        <CompletionistCard />
        <PlatformIdentityCard />
        <LibraryPostureCard />
      </ChipBand>
    </section>
  );
}
