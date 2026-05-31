import { CardShell } from "@/components/card-shell";
import { Link } from "@tanstack/react-router";
import { relativeTimeAgo } from "@vyoh/shared";
import { steamAchievementIconUrl } from "./_shared/steam-image";
import { useRecentUnlocks } from "./use-recent-unlocks";

// Fetch 5 rows for the Profile chip — enough to fill the evidence list
// without dwarfing sibling chips. The full cross-game feed lives at
// /steam/achievements (S5 chunk 9).
const FETCH_LIMIT = 5;

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
          {relativeTimeAgo(latest.unlockedAt)}
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
                  src={steamAchievementIconUrl(u.appid, u.apiName)}
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
                  {relativeTimeAgo(u.unlockedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      }
    />
  );
}
