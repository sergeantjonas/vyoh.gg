import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { Link } from "@tanstack/react-router";
import type { SteamPortraitGameRef } from "@vyoh/shared";
import { formatHoursMinutes } from "@vyoh/shared";

import { useSteamPortrait } from "./use-portrait";

const TITLE = "Single-achievement club";

export function SingleAchievementCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Checking who stopped at one…"
      errorLabel="The single-achievement club is unavailable right now."
      emptyLabel="No game is sitting on exactly one unlocked achievement."
      isEmpty={(data) => data.anti.singleAchievement.games.length === 0}
    >
      {({ anti }) => {
        const { games, withAnyUnlock, withSchema } = anti.singleAchievement;

        return (
          <FactCard
            title={TITLE}
            metric={games.length}
            metricLabel={{ singular: "game", plural: "games" }}
            verdict={`${games.length} ${games.length === 1 ? "game is" : "games are"} sitting on exactly one unlocked achievement.`}
            prescription={`${withAnyUnlock} of the ${withSchema} games that ship achievements have earned any at all.`}
            evidence={<ClubList games={games} />}
          />
        );
      }}
    </FactCardData>
  );
}

// Playtime is the joke: one achievement after twenty minutes is a launch
// screen, one after two hours is a decision.
function ClubList({ games }: { games: SteamPortraitGameRef[] }) {
  return (
    <ul className="flex flex-col gap-1 text-muted-foreground/80 text-xs">
      {games.slice(0, 4).map((game) => (
        <li key={game.appid} className="flex items-baseline gap-2">
          {/* Whole hours would round 97 minutes and 147 minutes to the same
              "2h", which is the one distinction this list exists to draw. */}
          <span className="w-16 shrink-0 text-right tabular-nums">
            {formatHoursMinutes(game.minutes)}
          </span>
          <Link
            to="/steam/library/$appid"
            params={{ appid: String(game.appid) }}
            className="truncate text-foreground/70 underline-offset-2 hover:underline"
          >
            {game.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
