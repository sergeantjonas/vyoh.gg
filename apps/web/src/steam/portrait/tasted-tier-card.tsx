import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { formatHoursMinutes } from "@vyoh/shared";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Tasted tier";

export function TastedTierCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Counting the half-tries…"
      errorLabel="The tasted tier is unavailable right now."
      emptyLabel="Nothing was opened and abandoned — every launched game got an hour."
      isEmpty={(data) => data.anti.tasted.count === 0}
    >
      {({ anti, posture }) => {
        const { count, totalMinutes, medianMinutes } = anti.tasted;

        return (
          <FactCard
            title={TITLE}
            metric={count}
            metricLabel={{ singular: "game", plural: "games" }}
            verdict={`${count} ${count === 1 ? "game" : "games"} opened and given up on, for ${formatHoursMinutes(totalMinutes)} between them.`}
            prescription={`The median one lasted ${medianMinutes} minutes. ${posture.ghostCount} more were never opened at all.`}
          />
        );
      }}
    </FactCardData>
  );
}
