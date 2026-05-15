import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/steam/achievements")({
  component: AchievementsPage,
});

function AchievementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-sm text-muted-foreground">
          Per-game completion verdicts, rarity-weighted scoring, and unlock timelines land
          in Phase S5.
        </p>
      </div>
      <div className="rounded-lg border border-dashed bg-card/30 px-6 py-12 text-center text-sm text-muted-foreground">
        The achievement data layer is being built first. Surfaces light up once the
        substrate is in place.
      </div>
    </div>
  );
}
