import { Link } from "@tanstack/react-router";
import { FactCard } from "./_shared/fact-card";
import { useSteamOwnedGames } from "./use-owned-games";

function minutesToHours(minutes: number): number {
  return Math.round(minutes / 60);
}

export function OwnedGamesChip() {
  const { data, isPending, isError } = useSteamOwnedGames();

  if (isPending) {
    return <FactCard title="Most played" verdict="Loading playtime…" empty />;
  }

  if (isError || !data) {
    return (
      <FactCard title="Most played" verdict="Playtime is unavailable right now." empty />
    );
  }

  const everLaunched = data.games.filter((g) => g.playtimeForeverMinutes > 0);
  const top = everLaunched[0];
  if (top === undefined) {
    return (
      <FactCard
        title="Most played"
        verdict="Nothing played yet — first poll lands at 04:00 Brussels time."
        empty
      />
    );
  }

  const lifetimeHours = minutesToHours(top.playtimeForeverMinutes);
  const recentHours = minutesToHours(top.playtime2WeeksMinutes ?? 0);
  const verdict = `${lifetimeHours.toLocaleString("en-US")}h into ${top.name}.`;
  const prescription =
    recentHours > 0
      ? `${recentHours.toLocaleString("en-US")}h in the last two weeks.`
      : undefined;

  return (
    <FactCard
      title="Most played"
      metric={lifetimeHours}
      metricLabel={{ singular: "hour", plural: "hours" }}
      verdict={verdict}
      prescription={prescription}
      evidence={
        <Link
          to="/steam/game/$appid"
          params={{ appid: String(top.appid) }}
          className="text-sm text-foreground/70 underline-offset-2 hover:underline"
        >
          Open {top.name} →
        </Link>
      }
    />
  );
}
