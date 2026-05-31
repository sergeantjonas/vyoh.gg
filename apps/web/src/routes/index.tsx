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
import { useMainHeight } from "@/lib/use-main-height";
import { createFileRoute } from "@tanstack/react-router";

// Padding inside <main>'s wrapping div (`mx-auto max-w-4xl p-6`). We subtract
// this from main's measured clientHeight so the hero fills the actual content
// area inside that padding, not the full visible viewport — otherwise the
// chevron at `bottom-8` plus the wrapping padding would land below the fold.
const MAIN_VERTICAL_PADDING = 48;

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
  const mainHeight = useMainHeight();
  // Fill <main>'s visible viewport exactly, minus the wrapping div's p-6
  // padding. Measurement-based rather than `calc(100dvh-?rem)` so the height
  // stays accurate as the nav collapses on scroll, mobile chrome reflows,
  // accessibility font scaling kicks in, etc.
  const heroMinHeight =
    mainHeight !== null ? mainHeight - MAIN_VERTICAL_PADDING : undefined;
  return (
    <div className="relative flex flex-col">
      <section
        className="relative flex items-start justify-center pt-[8dvh]"
        style={heroMinHeight !== undefined ? { minHeight: heroMinHeight } : undefined}
      >
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
