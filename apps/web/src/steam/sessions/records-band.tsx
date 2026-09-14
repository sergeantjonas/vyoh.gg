import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import {
  OWNER_TIME_ZONE,
  type SteamSessionRecord,
  formatHoursMinutes,
} from "@vyoh/shared";
import { ChipBand } from "../portrait/chip-band";
import { clockOf } from "./session-copy";
import { useSteamSessions } from "./use-sessions";

const DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  day: "numeric",
  month: "short",
});

function when(r: SteamSessionRecord): string {
  return `${r.game.name}, ${DATE.format(new Date(r.startedAt))}`;
}

// Five records off the same query, each a chip: which session in the window
// was the longest, the latest to finish, the busiest for unlocks, the longest
// with nothing unlocked, and the quickest bounce. All unlock-free except one
// by construction, which is what lets the band say something on a week
// without a single achievement.
export function RecordsBand() {
  const query = useSteamSessions();
  const errorLabel = "Session records are unavailable right now.";
  const pendingLabel = "Reading the log…";

  return (
    <ChipBand columns={3}>
      <FactCardData
        query={query}
        title="Longest"
        pendingLabel={pendingLabel}
        errorLabel={errorLabel}
        emptyLabel="No closed session in the window yet."
        isEmpty={(d) => d.records.longest === null}
      >
        {({ records }) =>
          records.longest && (
            <FactCard
              title="Longest"
              verdict={`${formatHoursMinutes(records.longest.value)} in one sitting.`}
              prescription={when(records.longest)}
            />
          )
        }
      </FactCardData>
      <FactCardData
        query={query}
        title="Latest finish"
        pendingLabel={pendingLabel}
        errorLabel={errorLabel}
        emptyLabel="No closed session in the window yet."
        isEmpty={(d) =>
          d.records.latestFinish === null ||
          !d.sessions.some((s) => s.id === d.records.latestFinish?.sessionId)
        }
      >
        {({ records, sessions }) => {
          const r = records.latestFinish;
          const s = sessions.find((x) => x.id === r?.sessionId);
          if (!r || !s) return null;
          // Past midnight but still before noon; a run that ends the next
          // afternoon is a `longest` story, and the clock alone says so.
          const morningAfter = r.value >= 24 * 60 && r.value < 36 * 60;
          return (
            <FactCard
              title="Latest finish"
              verdict={`${clockOf(s.endedAt)}${morningAfter ? ", the morning after" : ""}.`}
              prescription={when(r)}
            />
          );
        }}
      </FactCardData>
      <FactCardData
        query={query}
        title="Busiest"
        pendingLabel={pendingLabel}
        errorLabel={errorLabel}
        emptyLabel="No unlock landed inside an observed session in the window."
        emptyPrescription="Unlocks from sessions the api did not see are listed off-camera."
        isEmpty={(d) => d.records.mostUnlocks === null}
      >
        {({ records }) =>
          records.mostUnlocks && (
            <FactCard
              title="Busiest"
              metric={records.mostUnlocks.value}
              metricLabel={{ singular: "unlock", plural: "unlocks" }}
              verdict={`${records.mostUnlocks.value} achievements in one session.`}
              prescription={when(records.mostUnlocks)}
            />
          )
        }
      </FactCardData>
      <FactCardData
        query={query}
        title="Longest dry spell"
        pendingLabel={pendingLabel}
        errorLabel={errorLabel}
        emptyLabel="Every observed session in a game with achievements unlocked something."
        isEmpty={(d) => d.records.longestDrySpell === null}
      >
        {({ records }) =>
          records.longestDrySpell && (
            <FactCard
              title="Longest dry spell"
              verdict={`${formatHoursMinutes(records.longestDrySpell.value)} without a single unlock.`}
              prescription={when(records.longestDrySpell)}
            />
          )
        }
      </FactCardData>
      <FactCardData
        query={query}
        title="Quickest bounce"
        pendingLabel={pendingLabel}
        errorLabel={errorLabel}
        emptyLabel="No session in the window was short enough to call a bounce."
        isEmpty={(d) => d.records.quickestBounce === null}
      >
        {({ records }) =>
          records.quickestBounce && (
            <FactCard
              title="Quickest bounce"
              verdict={`Closed after ${formatHoursMinutes(records.quickestBounce.value)}.`}
              prescription={when(records.quickestBounce)}
            />
          )
        }
      </FactCardData>
    </ChipBand>
  );
}
