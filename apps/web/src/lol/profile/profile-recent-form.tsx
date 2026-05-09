import { MatchPips } from "@/lol/_shared/match-pips";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { useLpDeltaMap } from "@/lol/matches/use-lp-delta";
import { computeStreak } from "@/lol/trends/trend-stats";
import { TrendStreak } from "@/lol/trends/trend-streak";
import { useNavigate } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";

const FORM_LENGTH = 20;

function PipTooltip({ match, lpDelta }: { match: MatchSummary; lpDelta?: number }) {
  const kda =
    match.deaths === 0
      ? `${match.kills + match.assists}`
      : ((match.kills + match.assists) / match.deaths).toFixed(2);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-sm font-semibold leading-tight">{match.champion}</div>
      <div className="text-xs text-muted-foreground">{match.queueType}</div>
      <div className="mt-0.5 font-mono text-xs">
        {match.kills}/{match.deaths}/{match.assists}{" "}
        <span className="text-muted-foreground">({kda} KDA)</span>
      </div>
      {!match.remake && lpDelta !== undefined && (
        <div
          className={
            lpDelta > 0
              ? "text-xs tabular-nums text-emerald-400"
              : lpDelta < 0
                ? "text-xs tabular-nums text-red-400"
                : "text-xs tabular-nums text-muted-foreground"
          }
        >
          {lpDelta > 0 ? "+" : ""}
          {lpDelta} LP
        </div>
      )}
    </div>
  );
}

export function ProfileRecentForm({ accountSlug }: { accountSlug: string }) {
  const { matches } = useMatchWindow();
  const navigate = useNavigate();
  const lpDeltaMap = useLpDeltaMap();
  const recent = matches?.filter((m) => !m.remake).slice(0, FORM_LENGTH) ?? [];

  if (recent.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Recent Form
        </div>
        <TrendStreak streak={computeStreak(recent)} />
      </div>
      <MatchPips
        matches={recent}
        variant="pips"
        onMatchClick={(match) =>
          navigate({
            to: "/lol/$accountSlug/matches/$matchId",
            params: { accountSlug, matchId: match.matchId },
          })
        }
        renderTooltip={(match) => (
          <PipTooltip match={match} lpDelta={lpDeltaMap.get(match.matchId)} />
        )}
      />
    </div>
  );
}
