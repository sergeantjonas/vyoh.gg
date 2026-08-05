import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { Link } from "@tanstack/react-router";
import { formatPlaytime } from "@vyoh/shared";
import { useSteamPortrait } from "./use-portrait";

const TITLE = "Library posture";

export function LibraryPostureCard() {
  const query = useSteamPortrait();

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Counting the shelf…"
      errorLabel="Library posture is unavailable right now."
      emptyLabel="Library hasn't synced yet — first poll lands at 04:00 Brussels time."
      isEmpty={(data) => data.posture.ownedCount === 0}
    >
      {({ posture }) => {
        const share =
          posture.totalMinutes === 0
            ? 0
            : (posture.meaningfulMinutes / posture.totalMinutes) * 100;

        return (
          <FactCard
            title={TITLE}
            metric={posture.meaningfulCount}
            metricLabel={{ singular: "game", plural: "games" }}
            verdict={`${posture.meaningfulCount} of ${posture.ownedCount} owned games have had more than an hour.`}
            // The never-launched count belongs to the Anti-Portrait's masthead
            // and is the page's sharpest number; restating it here spent this
            // card's second line saying something the reader meets twice more.
            prescription={`Those ${posture.meaningfulCount} hold ${share.toFixed(1)}% of your ${formatPlaytime(posture.totalMinutes)}.`}
            evidence={
              <Link
                to="/steam/library"
                className="text-foreground/70 text-sm underline-offset-2 hover:underline"
              >
                See the full library →
              </Link>
            }
          />
        );
      }}
    </FactCardData>
  );
}
