import { ChartTooltipShell } from "@/components/chart-tooltip";
import { formatRank } from "@vyoh/shared/lol/rank-history";
import {
  type ChartPoint,
  POINT_FMT,
  formatBucketHeader,
} from "./profile-lp-history-helpers";

export function LpTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  const point = payload?.[0]?.payload;
  const bucket = point?.bucket;
  return (
    <ChartTooltipShell className="text-sm">
      {active && point ? (
        <>
          <div className="mb-0.5 text-xs text-muted-foreground">
            {bucket
              ? formatBucketHeader(bucket)
              : POINT_FMT.format(new Date(point.realT))}
          </div>
          <div className="font-semibold">
            {formatRank(point.tier, point.rank, point.leaguePoints)}
          </div>
          {bucket ? (
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  {bucket.gameCount} {bucket.gameCount === 1 ? "game" : "games"}
                </span>
                {(bucket.winCount > 0 || bucket.lossCount > 0) && (
                  <span>
                    <span className="text-emerald-400">{bucket.winCount}W</span>
                    {" – "}
                    <span className="text-rose-400">{bucket.lossCount}L</span>
                  </span>
                )}
                <span
                  className={
                    bucket.netLp > 0
                      ? "text-emerald-400"
                      : bucket.netLp < 0
                        ? "text-rose-400"
                        : "text-muted-foreground"
                  }
                >
                  {bucket.netLp > 0 ? "+" : ""}
                  {bucket.netLp} LP
                </span>
              </div>
              {bucket.highLp !== bucket.lowLp && (
                <div>
                  Range {bucket.lowLp}–{bucket.highLp} LP
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </ChartTooltipShell>
  );
}
