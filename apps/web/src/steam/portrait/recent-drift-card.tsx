import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { formatPlaytime, isThinGenre } from "@vyoh/shared";
import { joinGenres, leadingGenres } from "./leading-genres";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Lately";

export function RecentDriftCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading the recent window…"
      errorLabel="The recent window is unavailable right now."
    >
      {({ lifetime, recent }) => {
        if (recent === null) {
          return (
            <FactCard
              title={TITLE}
              verdict="No window to measure yet."
              prescription="A drift needs two playtime snapshots to sit between."
              empty
            />
          );
        }

        const { window, fingerprint } = recent;
        const leading = leadingGenres(fingerprint.genres);
        const anchor = leading[0];

        // Every genre resting on one game is not a drift, it is a weekend.
        // Saying so is the honest card; ranking it would be inventing a trend.
        if (anchor === undefined || isThinGenre(anchor)) {
          return (
            <FactCard
              title={TITLE}
              metric={window.days}
              metricLabel={{ singular: "day", plural: "days" }}
              verdict="Not enough recent play to call a drift."
              prescription={`${fingerprint.gamesCounted} ${fingerprint.gamesCounted === 1 ? "game" : "games"} and ${formatPlaytime(fingerprint.distributedMinutes)} in the last ${window.days} days — every genre in that rests on a single title.`}
              empty
            />
          );
        }

        const lifetimeAnchor = lifetime.genres[0]?.tag;

        return (
          <FactCard
            title={TITLE}
            metric={window.days}
            metricLabel={{ singular: "day", plural: "days" }}
            verdict={
              lifetimeAnchor === anchor.tag
                ? `Still ${anchor.tag}.`
                : `Lifetime ${lifetimeAnchor ?? "unplaced"}; lately ${joinGenres(leading)}.`
            }
            prescription={`${formatPlaytime(fingerprint.distributedMinutes)} across ${fingerprint.gamesCounted} ${fingerprint.gamesCounted === 1 ? "game" : "games"} in the last ${window.days} days.`}
          />
        );
      }}
    </FactCardData>
  );
}
