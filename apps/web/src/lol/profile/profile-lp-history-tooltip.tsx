import { formatRank } from "@vyoh/shared/lol/rank-history";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type ChartPoint, formatBucketHeader } from "./profile-lp-history-helpers";

export function LpTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  const reduced = useReducedMotion();
  const point = payload?.[0]?.payload;
  const bucket = point?.bucket;
  return (
    <AnimatePresence>
      {active && point ? (
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? {} : { opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="rounded-md border bg-popover/85 px-3 py-2 text-sm text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <div className="mb-0.5 text-xs text-muted-foreground">
            {bucket
              ? formatBucketHeader(bucket)
              : new Date(point.realT).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
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
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
