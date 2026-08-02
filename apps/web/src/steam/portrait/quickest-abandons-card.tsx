import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { Link } from "@tanstack/react-router";
import type { SteamPortraitGameRef } from "@vyoh/shared";

import { useSteamPortrait } from "./use-portrait";

const TITLE = "Quickest abandons";

export function QuickestAbandonsCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Finding the shortest sittings…"
      errorLabel="The shortest sittings are unavailable right now."
      emptyLabel="No game was opened and dropped inside the hour."
      isEmpty={(data) => data.anti.tasted.quickest.length === 0}
    >
      {({ anti }) => {
        const quickest = anti.tasted.quickest;
        // Non-null by the isEmpty gate above, but the index signature is
        // checked and the fallback would be a lie, so branch rather than `!`.
        const shortest = quickest[0];
        if (shortest === undefined) return null;

        return (
          <FactCard
            title={TITLE}
            metric={shortest.minutes}
            metricLabel={{ singular: "minute", plural: "minutes" }}
            verdict={`${shortest.name} lasted ${shortest.minutes} ${shortest.minutes === 1 ? "minute" : "minutes"}.`}
            prescription="Steam counts a launch the moment the window opens, so some of these are a menu and a change of mind."
            evidence={<AbandonList games={quickest.slice(1)} />}
          />
        );
      }}
    </FactCardData>
  );
}

function AbandonList({ games }: { games: SteamPortraitGameRef[] }) {
  if (games.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1 text-muted-foreground/80 text-xs">
      {games.map((game) => (
        <li key={game.appid} className="flex items-baseline gap-2">
          <span className="w-10 shrink-0 text-right tabular-nums">{game.minutes}m</span>
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
