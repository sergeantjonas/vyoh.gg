import { Link } from "@tanstack/react-router";
import { formatHoursMinutes } from "@vyoh/shared";
import { FactCard } from "./_shared/fact-card";
import { FactCardData } from "./_shared/fact-card-data";
import { headlineFor, liveHeadlineFor } from "./sessions/session-copy";
import { useElapsedMinutes } from "./sessions/use-elapsed-minutes";
import { useSteamSessions } from "./sessions/use-sessions";

const TITLE = "Last session";
/** Enough weeks for a quiet month to still produce a session, cheap enough to fetch for a chip. */
const CHIP_WEEKS = 4;

// The one curated highlight the landing page carries from the sessions route,
// per the per-stream rule: the headline the beat model gives the last (or
// current) session, and a link into the page that explains it. Everything
// else about sessions lives at /steam/sessions.
export function LastSessionChip() {
  const query = useSteamSessions(CHIP_WEEKS);
  const live = query.data?.live ?? null;
  const elapsed = useElapsedMinutes(
    live?.startedAt ?? null,
    query.data?.window.to ?? null
  );

  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading the log…"
      errorLabel="The session log is unavailable right now."
      emptyLabel={`No session observed in the last ${CHIP_WEEKS} weeks.`}
      emptyPrescription="Sessions are recorded while the api is running and a game is open."
      isEmpty={(d) => d.live === null && d.sessions.length === 0}
    >
      {(data) => {
        const latest = data.sessions[0];
        const headline = data.live
          ? liveHeadlineFor(data.live, elapsed, "named", data.sessions, CHIP_WEEKS)
          : latest
            ? headlineFor(latest)
            : null;
        const game = data.live?.game ?? latest?.game;
        if (!headline || !game) return null;
        // The sentence names the game itself, so the verdict is the sentence
        // and the game-plus-duration line sits under it as the receipt.
        const duration = data.live
          ? headline.masthead
          : latest
            ? formatHoursMinutes(latest.durationMinutes)
            : "";
        return (
          <FactCard
            title={data.live ? "Now playing" : TITLE}
            metric={data.window.sessionCount}
            metricLabel={{ singular: "session", plural: "sessions" }}
            verdict={headline.sentence}
            prescription={headline.chips.join(" · ") || undefined}
            evidence={
              <div className="flex flex-col gap-1.5 text-xs">
                <p className="text-muted-foreground/80 tabular-nums">
                  {game.name} · {duration}
                </p>
                <Link
                  to="/steam/sessions"
                  className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Every session, the strip and the rhythm →
                </Link>
              </div>
            }
          />
        );
      }}
    </FactCardData>
  );
}
