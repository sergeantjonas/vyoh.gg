import { SectionTitle } from "@/components/ui/section-title";
import { CompletionistCard } from "./completionist-card";
import { GenreAnchorCard } from "./genre-anchor-card";
import { LibraryPostureCard } from "./library-posture-card";
import { PlatformIdentityCard } from "./platform-identity-card";
import { RecentDriftCard } from "./recent-drift-card";

// Bare wrapper, chromed children: each card carries its own frosted shell, so
// wrapping the band would nest chrome inside chrome. The header does the
// dividing work instead — see the chrome-composition rule in
// docs/repo-conventions.md.
export function PortraitSection() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle as="h2">Portrait</SectionTitle>
        {/* Steam's Web API exposes no publisher genre, so the whole genre half
            of this section is inferred. Saying so is load-bearing for a page
            whose pitch is being honest about its own data. */}
        <p className="text-muted-foreground/70 text-xs">
          Genres derived from community tags
        </p>
      </div>
      {/* `items-start` because these cards carry wildly different amounts of
          prose — stretching each to its row partner's height opens a void
          under the short ones. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <GenreAnchorCard />
        <RecentDriftCard />
        <CompletionistCard />
        <PlatformIdentityCard />
        <LibraryPostureCard />
      </div>
    </section>
  );
}
