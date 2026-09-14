import { FactCard } from "@/steam/_shared/fact-card";
import { FactCardData } from "@/steam/_shared/fact-card-data";
import { steamAchievementIconUrl } from "@/steam/_shared/steam-image";
import { Link } from "@tanstack/react-router";
import { OWNER_TIME_ZONE, type SteamOffCameraUnlockGroup } from "@vyoh/shared";
import { useSteamSessions } from "./use-sessions";

const TITLE = "Off camera";
const ROWS_SHOWN = 6;

const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: OWNER_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** `YYYY-MM-DD` as an owner-local day, formatted without a timezone shift. */
function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return DAY.format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)));
}

// The coverage caveat as a feature: sessions exist only where the api was
// running, and Steam stamps every unlock regardless, so the unlocks no
// session can claim are exactly the play the log missed. Listing them makes
// the gaps legible instead of letting the records above imply completeness.
export function OffCameraLedger() {
  const query = useSteamSessions();
  return (
    <FactCardData
      query={query}
      title={TITLE}
      pendingLabel="Reading the log…"
      errorLabel="The ledger is unavailable right now."
      emptyLabel="Every unlock in the window landed inside an observed session."
      emptyPrescription="The api saw every evening it needed to."
      isEmpty={(d) => d.offCamera.length === 0}
    >
      {({ offCamera }) => {
        const total = offCamera.reduce((n, g) => n + g.count, 0);
        const days = new Set(offCamera.map((g) => g.day)).size;
        const games = new Set(offCamera.map((g) => g.game.appid)).size;
        return (
          <FactCard
            title={TITLE}
            metric={total}
            metricLabel={{ singular: "unlock", plural: "unlocks" }}
            verdict={`${total} ${total === 1 ? "unlock" : "unlocks"} across ${days} ${days === 1 ? "day" : "days"} and ${games} ${games === 1 ? "game" : "games"} landed while the api was not watching.`}
            prescription="Sessions are recorded only while the api runs, so these are evenings the log has no row for."
            evidence={
              <ul className="flex flex-col gap-1.5">
                {offCamera.slice(0, ROWS_SHOWN).map((g) => (
                  <LedgerRow key={`${g.game.appid}-${g.day}`} group={g} />
                ))}
                {offCamera.length > ROWS_SHOWN && (
                  <li className="text-muted-foreground/70 text-xs">
                    and {offCamera.length - ROWS_SHOWN} more{" "}
                    {offCamera.length - ROWS_SHOWN === 1 ? "row" : "rows"}
                  </li>
                )}
              </ul>
            }
          />
        );
      }}
    </FactCardData>
  );
}

function LedgerRow({ group }: { group: SteamOffCameraUnlockGroup }) {
  const more = group.count - group.sample.length;
  return (
    <li className="flex items-center gap-3">
      <div className="flex shrink-0 -space-x-1.5">
        {group.sample.map((u) => (
          <img
            key={u.apiName}
            src={steamAchievementIconUrl(group.game.appid, u.apiName)}
            alt=""
            loading="lazy"
            className="size-6 rounded ring-1 ring-background"
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          to="/steam/library/$appid"
          params={{ appid: String(group.game.appid) }}
          className="truncate font-medium text-foreground/90 text-sm hover:underline"
        >
          {group.game.name}
        </Link>
        <p className="truncate text-muted-foreground text-xs">
          {group.sample.map((u) => u.displayName).join(", ")}
          {more > 0 ? ` and ${more} more` : ""}
        </p>
      </div>
      <span className="shrink-0 text-muted-foreground/70 text-xs tabular-nums">
        {dayLabel(group.day)} · {group.count}
      </span>
    </li>
  );
}
