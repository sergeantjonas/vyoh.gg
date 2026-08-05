import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";

import { OpenGameLink, describeGenres } from "./suggestion-match";
import { useSteamPortrait } from "./use-portrait";

// The catalog called this one "Tasted but never returned", which claims more
// than the data holds: playtime is a cumulative counter, so 49 minutes could be
// one sitting or three, and the session table is too thin to say which.
const TITLE = "Worth reopening";

export function WorthReopeningCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading what you dropped…"
      errorLabel="The abandoned matches are unavailable right now."
      emptyLabel="Nothing you dropped inside the hour matches what you play."
      emptyPrescription="Which is its own answer: the games that didn't stick weren't your genres to begin with."
      isEmpty={(data) => data.backlog.regret === null}
    >
      {({ backlog }) => {
        const regret = backlog.regret;
        if (regret === null) return null;

        return (
          <FactCard
            title={TITLE}
            verdict={`${regret.name} got ${regret.minutes} ${regret.minutes === 1 ? "minute" : "minutes"} and stopped there.`}
            // Deliberately not the pick card's "N of its M genres" opening:
            // live, both games match on all of theirs, so the two cards would
            // otherwise begin with the same sentence side by side. The contrast
            // is this card's point anyway — the arithmetic is the pick's.
            prescription={`Whatever stopped you, it wasn't the genre: ${describeGenres(regret)}.`}
            evidence={<OpenGameLink appid={regret.appid} name={regret.name} />}
          />
        );
      }}
    </FactCardData>
  );
}
