import { BentoGrid, BentoTile } from "@/components/bento/bento-grid";
import { LandingHeading } from "@/home/landing-heading";
import { TileBuildBadge } from "@/home/tile-build-badge";
import { TileChronotype } from "@/home/tile-chronotype";
import { TileDaySplit } from "@/home/tile-day-split";
import { TileDomainAge } from "@/home/tile-domain-age";
import { TileFirstPlayed } from "@/home/tile-first-played";
import { TileLastMatch } from "@/home/tile-last-match";
import { TileSessionLengths } from "@/home/tile-session-lengths";
import { TileSignatureGame } from "@/home/tile-signature-game";
import { TileWeeklyTotals } from "@/home/tile-weekly-totals";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { account } = usePrimaryAccount();
  return (
    <div className="flex flex-col gap-6">
      <LandingHeading />
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
        <BentoTile width={2}>
          <TileFirstPlayed />
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
