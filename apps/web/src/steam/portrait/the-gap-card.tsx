import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "The gap";

// The section's closing statement rather than another fact. Every number in it
// was already earned by a card above; this one only puts them in one sentence.
export function TheGapCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Adding it up…"
      errorLabel="The verdict is unavailable right now."
      emptyLabel="Nothing to add up until the library syncs."
      isEmpty={(data) => data.posture.ownedCount === 0}
    >
      {({ posture, completion }) => (
        <FactCard
          title={TITLE}
          verdict={`You own ${posture.ownedCount} games, meaningfully played ${posture.meaningfulCount}, finished ${completion.finishedCount}. The gap is the hobby.`}
          // "Finished" is the narrowest word on the page, so it says which
          // games it was allowed to count rather than implying 18 of 186.
          prescription={`Finished means past 80% of the achievements, counted over the ${completion.cohortCount} games with a schema and ten hours in them.`}
        />
      )}
    </FactCardData>
  );
}
