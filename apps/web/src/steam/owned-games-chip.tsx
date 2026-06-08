import { Link } from "@tanstack/react-router";
import { FactCard } from "./_shared/fact-card";
import { FactCardData } from "./_shared/fact-card-data";
import { useSteamOwnedGames } from "./use-owned-games";

function minutesToHours(minutes: number): number {
  return Math.round(minutes / 60);
}

export function OwnedGamesChip() {
  const query = useSteamOwnedGames();

  return (
    <FactCardData
      query={query}
      title="Most played"
      pendingLabel="Loading playtime…"
      errorLabel="Playtime is unavailable right now."
      emptyLabel="Nothing played yet — first poll lands at 04:00 Brussels time."
      isEmpty={(data) => data.games.every((g) => g.playtimeForeverMinutes === 0)}
    >
      {(data) => {
        const top = data.games.find((g) => g.playtimeForeverMinutes > 0);
        if (top === undefined) return null;
        const lifetimeHours = minutesToHours(top.playtimeForeverMinutes);
        const recentHours = minutesToHours(top.playtime2WeeksMinutes ?? 0);
        return (
          <FactCard
            title="Most played"
            metric={lifetimeHours}
            metricLabel={{ singular: "hour", plural: "hours" }}
            verdict={`${lifetimeHours.toLocaleString("en-US")}h into ${top.name}.`}
            prescription={
              recentHours > 0
                ? `${recentHours.toLocaleString("en-US")}h in the last two weeks.`
                : undefined
            }
            evidence={
              <Link
                to="/steam/library/$appid"
                params={{ appid: String(top.appid) }}
                className="text-sm text-foreground/70 underline-offset-2 hover:underline"
              >
                Open {top.name} →
              </Link>
            }
          />
        );
      }}
    </FactCardData>
  );
}
