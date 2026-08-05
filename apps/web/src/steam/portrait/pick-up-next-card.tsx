import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";

import { OpenGameLink, describeCoverage, describeGenres } from "./suggestion-match";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Pick up next";

export function PickUpNextCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Scoring the shelf…"
      errorLabel="The recommendation is unavailable right now."
      emptyLabel="Nothing you own but haven't launched shares a genre with the portrait."
      emptyPrescription="The shelf is scored against what you actually play, so a library of bundle leftovers scores nothing."
      isEmpty={(data) => data.backlog.pick === null}
    >
      {({ backlog }) => {
        const pick = backlog.pick;
        if (pick === null) return null;

        return (
          <FactCard
            title={TITLE}
            verdict={`${pick.name} is the closest thing on your shelf to what you already play.`}
            // The denominator is the honest part: this is the best of a pool,
            // not an endorsement, and the pool is worth naming.
            prescription={`${describeCoverage(pick)}: ${describeGenres(pick)}. Picked from ${backlog.candidateCount} games you own and have never launched.`}
            evidence={<OpenGameLink appid={pick.appid} name={pick.name} />}
          />
        );
      }}
    </FactCardData>
  );
}
