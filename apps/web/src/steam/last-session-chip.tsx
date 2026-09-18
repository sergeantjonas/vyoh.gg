import { Link } from "@tanstack/react-router";
import { FactCard } from "./_shared/fact-card";
import { FactCardData } from "./_shared/fact-card-data";
import { RecentSessionRows } from "./sessions/recent-session-rows";
import { headlineFor, liveHeadlineFor } from "./sessions/session-copy";
import { SessionDayStrip } from "./sessions/session-day-strip";
import { useElapsedMinutes } from "./sessions/use-elapsed-minutes";
import { useSteamSessions } from "./sessions/use-sessions";

const TITLE = "Last session";
/** Enough weeks for a quiet month to still produce a session, cheap enough to fetch for a chip. */
const CHIP_WEEKS = 4;
const CHIP_DAYS = CHIP_WEEKS * 7;
/** Five rows plus the strip fill the height the paired unlocks card sets; a sixth overflows it. */
const ROW_LIMIT = 5;

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
        return (
          <FactCard
            title={data.live ? "Now playing" : TITLE}
            metric={data.window.sessionCount}
            metricLabel={{ singular: "session", plural: "sessions" }}
            verdict={headline.sentence}
            prescription={headline.chips.join(" · ") || undefined}
            evidenceFills
            evidence={
              <div className="flex flex-1 flex-col gap-3 text-xs">
                {/* The running session is the one the rows below cannot show —
                    it has no end yet — so the counter is its only receipt. A
                    finished session is already the first row, to the minute. */}
                {data.live && (
                  <p className="text-muted-foreground/80 tabular-nums">
                    Playing for {headline.masthead}
                  </p>
                )}
                <SessionDayStrip
                  sessions={data.sessions}
                  live={data.live}
                  timeZone={data.timeZone}
                  days={CHIP_DAYS}
                  through={data.window.to}
                />
                <RecentSessionRows
                  sessions={data.sessions}
                  limit={ROW_LIMIT}
                  headlineAppid={game.appid}
                />
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
