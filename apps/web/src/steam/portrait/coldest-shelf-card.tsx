import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { Link } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";

import { monthAndYear } from "./month-year";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Coldest shelf";

export function ColdestShelfCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Finding the bottom of the shelf…"
      errorLabel="The coldest shelf is unavailable right now."
      emptyLabel="Nothing played is old enough to have gone cold."
      emptyPrescription="Steam only reports a last-played date for games it has seen launched."
      isEmpty={(data) => data.anti.coldest === null}
    >
      {({ anti }) => {
        const coldest = anti.coldest;
        if (coldest === null) return null;

        return (
          <FactCard
            title={TITLE}
            verdict={`${coldest.name} hasn't been launched since ${monthAndYear(coldest.lastPlayed)}.`}
            prescription={`${formatPlaytime(coldest.minutes)} are already in it — this is a shelf that went cold, not one that was never opened.`}
            evidence={
              <Link
                to="/steam/library/$appid"
                params={{ appid: String(coldest.appid) }}
                className="text-foreground/70 text-sm underline-offset-2 hover:underline"
              >
                Open {coldest.name} →
              </Link>
            }
          />
        );
      }}
    </FactCardData>
  );
}
