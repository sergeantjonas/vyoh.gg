import { BentoGrid, BentoTile } from "@/components/bento/bento-grid";
import { AmbientHero } from "@/home/ambient-hero";
import { AtmosphereProvider } from "@/home/atmosphere/atmosphere-provider";
import { LandingHeading } from "@/home/landing-heading";
import { LandingSteamBand } from "@/home/landing-steam-band";
import { AhriChapter } from "@/home/recap/ahri-chapter";
import { NextChapterCaret } from "@/home/recap/next-chapter-caret";
import { SteamChapter } from "@/home/recap/steam-chapter";
import { TileBuildBadge } from "@/home/tile-build-badge";
import { TileChronotype } from "@/home/tile-chronotype";
import { TileDaySplit } from "@/home/tile-day-split";
import { TileDomainAge } from "@/home/tile-domain-age";
import { TileLastMatch } from "@/home/tile-last-match";
import { TileSessionLengths } from "@/home/tile-session-lengths";
import { TileSignatureGame } from "@/home/tile-signature-game";
import { TileWeeklyTotals } from "@/home/tile-weekly-totals";
import { useHomeActivityIntensity } from "@/home/use-home-activity-intensity";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  component: HomePage,
  // Skip the global scope-fade in <RootLayout> for the landing mount — the
  // landing owns its own entrance via <LandingHeading>'s editorial cascade and
  // <LandingSteamBand> / <BentoGrid>'s whileInView gates.
  staticData: { ownsEntry: true },
});

function HomePage() {
  const { account } = usePrimaryAccount();
  const { data: activity } = useHomeActivityIntensity();
  // Hero-band ref is the proximity target for the hero's atmosphere claim. The
  // atmosphere layer reads its bounding rect each scroll tick to weight the
  // hero's contribution against any subsequent band's claim.
  const heroRef = useRef<HTMLElement | null>(null);
  return (
    <AtmosphereProvider>
      <div className="relative flex flex-col">
        {/* `--main-h` is written by <main>'s callback ref in __root.tsx (and kept
            current by a ResizeObserver there) — its value is <main>'s actual
            clientHeight, so subtracting 3rem (the wrapping div's `p-6` top+bottom
            padding) gives the exact content-area height. The `100dvh` fallback
            covers the impossible case where the var isn't set yet — pragmatic
            over-cover rather than a precise approximation. */}
        <section
          ref={heroRef}
          className="relative flex min-h-[calc(var(--main-h,100dvh)-3rem)] items-start justify-center pt-[8dvh]"
        >
          <AmbientHero bandRef={heroRef} intensity={activity?.intensity} />
          <LandingHeading />
        </section>
        <NextChapterCaret />
        {/* First recap chapter (R-2). The bento below still renders — it
            retires in R-5 once the conclusion lands. Chapter only mounts
            when a primary LoL account is configured (so anonymous /
            visitors don't see a placeholder Ahri pin). */}
        {account ? <AhriChapter account={account} /> : null}
        {/* Second recap chapter (R-3). Hardcoded to STEAM_FEATURED_APPID in
            landing-config until R-4's `useChapters()` selection logic
            picks Steam chapters by recency-decayed score. */}
        <SteamChapter />
        <LandingSteamBand />
        <BentoGrid>
          <BentoTile width={2} height={2}>
            <TileChronotype />
          </BentoTile>
          <BentoTile width={2}>
            <TileSignatureGame account={account} />
          </BentoTile>
          <BentoTile width={2}>
            <TileLastMatch account={account} />
          </BentoTile>
          <BentoTile width={2}>
            <TileWeeklyTotals />
          </BentoTile>
          <BentoTile width={2} height={2}>
            <TileDaySplit />
          </BentoTile>
          <BentoTile width={2}>
            <TileSessionLengths />
          </BentoTile>
          <BentoTile>
            <TileBuildBadge />
          </BentoTile>
          <BentoTile>
            <TileDomainAge />
          </BentoTile>
        </BentoGrid>
      </div>
    </AtmosphereProvider>
  );
}
