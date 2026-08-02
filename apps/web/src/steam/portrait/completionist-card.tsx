import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { COMPLETIONIST_PLAYTIME_MINUTES, FINISHED_COMPLETION_SHARE } from "@vyoh/shared";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Completion";

const COHORT_HOURS = COMPLETIONIST_PLAYTIME_MINUTES / 60;
const FINISHED_PERCENT = Math.round(FINISHED_COMPLETION_SHARE * 100);

export function CompletionistCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading achievement progress…"
      errorLabel="Achievement progress is unavailable right now."
      emptyLabel={`No game with achievements has passed ${COHORT_HOURS} hours yet.`}
      emptyPrescription="Completion on a shorter game describes the first evening, not the player."
      isEmpty={(data) => data.completion.cohortCount === 0}
    >
      {({ completion, posture }) => (
        <FactCard
          title={TITLE}
          metric={completion.cohortCount}
          metricLabel={{ singular: "game", plural: "games" }}
          verdict={`${completion.cohortCount} of ${posture.ownedCount} owned games reach ${COHORT_HOURS} hours; ${completion.perfectCount} of those are at 100%.`}
          prescription={`Median completion across the ${completion.cohortCount} is ${Math.round(completion.medianCompletion * 100)}%. Games with no achievements are left out — there is nothing in them to finish.`}
          evidence={
            <p className="text-muted-foreground/80 text-xs tabular-nums">
              {completion.finishedCount} past {FINISHED_PERCENT}% ·{" "}
              {completion.perfectCount} at 100% ·{" "}
              {Math.round(completion.medianCompletion * 100)}% median
            </p>
          }
        />
      )}
    </FactCardData>
  );
}
