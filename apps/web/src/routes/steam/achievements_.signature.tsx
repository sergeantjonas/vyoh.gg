import { CompletionistAxisCard } from "@/steam/achievements/completionist-axis-card";
import { HundredPercentHall } from "@/steam/achievements/hundred-percent-hall";
import { RarestSection } from "@/steam/achievements/rarest-section";
import { SteamChronotypeTile } from "@/steam/achievements/steam-chronotype-tile";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/steam/achievements_/signature")({
  component: SignaturePage,
});

function SignaturePage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          to="/steam/achievements"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground/80 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Recent unlocks
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Signatures</h1>
        <p className="text-sm text-muted-foreground">
          Where the library stands on the completionist axis, the games already finished,
          and the rarest pulls so far.
        </p>
      </div>
      <div className="sm:max-w-md">
        <CompletionistAxisCard />
      </div>
      <div className="sm:max-w-md">
        <SteamChronotypeTile />
      </div>
      <HundredPercentHall />
      <RarestSection />
    </div>
  );
}
