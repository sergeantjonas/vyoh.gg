import {
  type SteamPlaySessionDigest,
  excludeBlipSessions,
  formatHoursMinutes,
} from "@vyoh/shared";
import { sessionSlotLabel } from "./session-copy";

// The sessions behind the landing card's headline, newest first. The headline
// names one session; these are the ones it sits among, which is what turns a
// single fact into a habit.
//
// The game name is dropped where the row would only repeat the sentence above
// it — the same `implicit` / `named` distinction `copyFor` draws, applied to a
// list: a fortnight of one game reads as a form when every row names it, and a
// row for a *different* game is exactly the one worth naming.
//
// The rows are text, not targets. A session has no page of its own, and the
// card already carries one link to where sessions live; five rows pointing at
// a game's library entry promised a detail view that does not exist.

export interface RecentSessionRowsProps {
  sessions: readonly SteamPlaySessionDigest[];
  limit: number;
  /** The game the card's headline is about; rows for it don't repeat the name. */
  headlineAppid?: number | undefined;
}

export function RecentSessionRows({
  sessions,
  limit,
  headlineAppid,
}: RecentSessionRowsProps) {
  const rows = excludeBlipSessions(
    sessions.map((s) => ({
      digest: s,
      appid: s.game.appid,
      startedAt: new Date(s.startedAt),
      endedAt: new Date(s.endedAt),
    }))
  ).slice(0, limit);
  if (rows.length === 0) return null;
  // Against the longest row rather than a fixed scale, so four evenings of
  // similar length still show which was the long one. The same choice the
  // strip's bars make against their peak.
  const longest = Math.max(...rows.map((r) => r.digest.durationMinutes), 1);

  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ digest: s }) => (
        <li key={s.id} className="flex items-center gap-2.5 py-1">
          {/* Decorative: the duration it encodes is spelled out at the end
                of the same row, so it says nothing a reader could miss. */}
          <span
            aria-hidden="true"
            className="flex h-1.5 w-16 shrink-0 items-center overflow-hidden rounded-full bg-muted-foreground/15"
          >
            <span
              className="h-full rounded-full bg-theme-strong/60"
              style={{
                width: `${Math.max(8, Math.round((s.durationMinutes / longest) * 100))}%`,
              }}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {s.game.appid === headlineAppid ? sessionSlotLabel(s.startedAt) : s.game.name}
          </span>
          {s.unlocks.length > 0 && (
            <span className="shrink-0 tabular-nums text-muted-foreground/60">
              {s.unlocks.length} unlock{s.unlocks.length === 1 ? "" : "s"}
            </span>
          )}
          <span className="shrink-0 tabular-nums text-foreground/80">
            {formatHoursMinutes(s.durationMinutes)}
          </span>
        </li>
      ))}
    </ul>
  );
}
