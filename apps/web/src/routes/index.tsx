import { BentoGrid, BentoTile } from "@/components/bento/bento-grid";
import { OrbMark } from "@/home/orb-mark";
import { TileBuildBadge } from "@/home/tile-build-badge";
import { TileChronotype } from "@/home/tile-chronotype";
import { TileDomainAge } from "@/home/tile-domain-age";
import { TileLastMatch } from "@/home/tile-last-match";
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
      <header className="flex flex-col items-center gap-3 text-center">
        <OrbMark className="size-40 sm:size-48" />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
          vyoh.gg
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          A self-portrait, in League and Steam.
        </h1>
      </header>
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
