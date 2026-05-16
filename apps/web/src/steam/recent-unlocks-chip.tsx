import { CardShell } from "@/components/card-shell";
import { Link } from "@tanstack/react-router";
import { useRecentUnlocks } from "./use-recent-unlocks";

// Fetch 5 rows for the Profile chip — enough to fill the evidence list
// without dwarfing sibling chips. The full cross-game feed lives at
// /steam/achievements (S5 chunk 9).
const FETCH_LIMIT = 5;

const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function relativeTimeSince(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  const days = Math.round(hours / 24);
  return relativeTime.format(days, "day");
}

export function RecentUnlocksChip() {
  const { data, isPending, isError } = useRecentUnlocks(FETCH_LIMIT);

  if (isPending) {
    return <CardShell title="Recent unlocks" verdict="Loading recent unlocks…" empty />;
  }

  if (isError || !data) {
    return (
      <CardShell
        title="Recent unlocks"
        verdict="Recent unlocks are unavailable right now."
        empty
      />
    );
  }

  const unlocks = data.unlocks;
  const [latest] = unlocks;
  if (!latest) {
    return (
      <CardShell title="Recent unlocks" verdict="No achievements unlocked yet." empty />
    );
  }

  return (
    <CardShell
      title="Recent unlocks"
      indicator={
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {relativeTimeSince(latest.unlockedAt)}
        </span>
      }
      verdict={`Last progressed in ${latest.gameName}.`}
      evidence={
        <ul className="flex flex-col gap-1.5">
          {unlocks.map((u) => (
            <li key={`${u.appid}-${u.apiName}`}>
              <Link
                to="/steam/game/$appid"
                params={{ appid: String(u.appid) }}
                search={{ ach: u.apiName }}
                className="flex items-center gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-background/40"
              >
                <img
                  src={u.iconUrl}
                  alt=""
                  loading="lazy"
                  className="size-10 shrink-0 rounded"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-medium text-foreground/90">
                    {u.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.gameName}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                  {relativeTimeSince(u.unlockedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      }
    />
  );
}
