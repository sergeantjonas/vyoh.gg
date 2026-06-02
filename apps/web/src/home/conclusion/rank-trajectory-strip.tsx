import { Sparkline } from "@/components/ui/sparkline";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import type { RankHistoryPoint } from "@vyoh/shared";
import { formatRank, normalizeLp } from "@vyoh/shared/lol/rank-history";

interface Trajectory {
  series: number[];
  firstPoint: RankHistoryPoint;
  lastPoint: RankHistoryPoint;
}

function buildTrajectory(points: RankHistoryPoint[]): Trajectory | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );
  const series = sorted.map((p) => normalizeLp(p.tier, p.rank, p.leaguePoints));
  const firstPoint = sorted[0];
  const lastPoint = sorted[sorted.length - 1];
  if (!firstPoint || !lastPoint) return null;
  return { series, firstPoint, lastPoint };
}

function formatDelta(start: number, end: number): string {
  const delta = end - start;
  if (delta === 0) return "±0 LP";
  return `${delta > 0 ? "+" : ""}${delta} LP`;
}

/**
 * Conclusion rank trajectory — 30-day solo queue LP arc for the primary
 * owner account. Reuses the existing `/lol/.../rank/history` endpoint
 * rather than introducing a home-scoped wrapper; identity is single-owner
 * so the per-account endpoint already returns only the data we want.
 * Hidden when the primary account has fewer than 2 solo snapshots in the
 * window (unranked / not enough history to draw a line).
 */
export function RankTrajectoryStrip() {
  const { account } = usePrimaryAccount();
  const query = useRankHistory(account, "30d");
  const trajectory = query.data ? buildTrajectory(query.data.solo) : null;

  if (!account || !trajectory) return null;

  const startLp = trajectory.series[0];
  const endLp = trajectory.series[trajectory.series.length - 1];
  if (startLp === undefined || endLp === undefined) return null;

  return (
    <section className="flex flex-col items-center gap-2 px-6 py-4 text-center">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Last 30 days
      </span>
      <div className="flex items-center gap-3 rounded-md border bg-card/40 px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {formatRank(
            trajectory.firstPoint.tier,
            trajectory.firstPoint.rank,
            trajectory.firstPoint.leaguePoints
          )}
        </span>
        <Sparkline
          data={trajectory.series}
          width={120}
          height={24}
          strokeWidth={1.5}
          aria-label="30-day solo queue LP trajectory"
        />
        <span className="text-xs font-medium text-foreground/90 tabular-nums">
          {formatRank(
            trajectory.lastPoint.tier,
            trajectory.lastPoint.rank,
            trajectory.lastPoint.leaguePoints
          )}
        </span>
        <span className="border-l pl-3 text-xs font-medium text-muted-foreground tabular-nums">
          {formatDelta(startLp, endLp)}
        </span>
      </div>
    </section>
  );
}
