import { Link } from "@tanstack/react-router";
import { FactCard } from "./_shared/fact-card";
import { useSteamForeverGames } from "./use-forever-games";

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

export function ForeverGamesChip() {
  const { data, isPending, isError } = useSteamForeverGames();

  if (isPending) {
    return <FactCard title="Forever games" verdict="Loading playtime…" empty />;
  }

  if (isError || !data) {
    return (
      <FactCard
        title="Forever games"
        verdict="Playtime is unavailable right now."
        empty
      />
    );
  }

  const everLaunched = data.games.filter((g) => g.playtimeForeverMinutes > 0);
  const top = everLaunched[0];
  if (top === undefined) {
    return (
      <FactCard
        title="Forever games"
        verdict="Nothing played yet — first poll lands at 04:00 Brussels time."
        empty
      />
    );
  }

  const verdict = `${formatHours(top.playtimeForeverMinutes)} into ${top.name}.`;
  const prescription = `Most-played of ${everLaunched.length} ever-launched ${
    everLaunched.length === 1 ? "title" : "titles"
  }.`;

  return (
    <FactCard
      title="Forever games"
      metric={everLaunched.length}
      metricLabel={{ singular: "game", plural: "games" }}
      verdict={verdict}
      prescription={prescription}
      evidence={
        <Link
          to="/steam/library"
          className="text-sm text-foreground/70 underline-offset-2 hover:underline"
        >
          See the full library →
        </Link>
      }
    />
  );
}
