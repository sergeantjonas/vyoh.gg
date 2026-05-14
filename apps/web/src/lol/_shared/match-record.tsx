import { MatchPips } from "@/lol/_shared/match-pips";
import { useChampionName } from "@/lol/champions/use-champions";
import { computeLpDeltaMap } from "@/lol/matches/use-lp-delta";
import { useNavigate } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

function PipTooltip({
  match,
  lpDelta,
  championName,
}: {
  match: MatchSummary;
  lpDelta?: number;
  championName: string;
}) {
  const kda =
    match.deaths === 0
      ? `${match.kills + match.assists}`
      : ((match.kills + match.assists) / match.deaths).toFixed(2);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-sm font-semibold leading-tight">{championName}</div>
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

export function MatchRecord({
  matches,
  accountSlug,
}: {
  matches: MatchSummary[];
  accountSlug: string;
}) {
  const navigate = useNavigate();
  const lpDeltaMap = useMemo(() => computeLpDeltaMap(matches), [matches]);
  const championName = useChampionName();

  return (
    <MatchPips
      matches={matches}
      onMatchClick={(match) =>
        navigate({
          to: "/lol/$accountSlug/matches/$matchId",
          params: { accountSlug, matchId: match.matchId },
        })
      }
      renderTooltip={(match) => (
        <PipTooltip
          match={match}
          lpDelta={lpDeltaMap.get(match.matchId)}
          championName={championName(match.champion)}
        />
      )}
    />
  );
}
