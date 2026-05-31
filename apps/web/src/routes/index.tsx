import { BentoGrid, BentoTile } from "@/components/bento/bento-grid";
import { AmbientHero } from "@/home/ambient-hero";
import { HeroScrollHint } from "@/home/hero-scroll-hint";
import { LandingHeading } from "@/home/landing-heading";
import { LandingSteamBand } from "@/home/landing-steam-band";
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
  return (
    <div className="relative flex flex-col">
      {/* Height = full viewport minus the chrome above <main> (sticky nav ~52px
          + ScrollProgress hairline + the wrapping div's `p-6` top/bottom).
          Without this, `min-h-dvh` exceeds main's clip and the chevron at
          `bottom-8` lands below the fold. ~7rem is a generous offset; if the
          nav grows, bump it. */}
      <section className="relative flex min-h-[calc(100dvh-7rem)] items-start justify-center pt-[8dvh]">
        <AmbientHero intensity={activity?.intensity} />
        <LandingHeading />
        <HeroScrollHint />
      </section>
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
  );
}
