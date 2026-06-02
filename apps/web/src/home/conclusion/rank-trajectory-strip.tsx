import { CardTitle } from "@/components/ui/card-title";
import { Sparkline } from "@/components/ui/sparkline";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import type { LolAccountWithSummary, RankHistoryPoint } from "@vyoh/shared";
import { formatRank, normalizeLp } from "@vyoh/shared/lol/rank-history";

// TEMP: trajectory points at Agurin's account so the strip has enough
// snapshot history to render during dev review. The primary owner's
// account is freshly tracked and currently sits below the 2-snapshot
// floor. Revert to `usePrimaryAccount()` once primary has 30d of capture.
const TEST_TRAJECTORY_ACCOUNT: LolAccountWithSummary = {
  slug: "agurin",
  gameName: "Agurin",
  tagLine: "DND",
  region: "euw1",
  profileIconId: null,
  summary: null,
};

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
 * window (unranked / not enough history to draw a line). Lives in the
 * "shape" section as the 30-day beat between the rolling rhythm samples
 * and the 24h today strip.
 */
export function RankTrajectoryStrip() {
  // TEMP override: swap to TEST_TRAJECTORY_ACCOUNT for dev review.
  // `usePrimaryAccount()` still resolves so the hook order stays stable.
  usePrimaryAccount();
  const account = TEST_TRAJECTORY_ACCOUNT;
  const query = useRankHistory(account, "30d");
  const trajectory = query.data ? buildTrajectory(query.data.solo) : null;

  if (!account || !trajectory) return null;

  const startLp = trajectory.series[0];
  const endLp = trajectory.series[trajectory.series.length - 1];
  if (startLp === undefined || endLp === undefined) return null;

  const deltaString = formatDelta(startLp, endLp);
  const startRank = formatRank(
    trajectory.firstPoint.tier,
    trajectory.firstPoint.rank,
    trajectory.firstPoint.leaguePoints
  );
  const endRank = formatRank(
    trajectory.lastPoint.tier,
    trajectory.lastPoint.rank,
    trajectory.lastPoint.leaguePoints
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
      <header className="flex flex-col gap-1">
        <CardTitle>Trajectory</CardTitle>
        <p className="text-sm text-muted-foreground">
          Solo queue · last 30 days ·{" "}
          <span className="font-medium text-foreground/80 tabular-nums">
            {deltaString}
          </span>
        </p>
      </header>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            From
          </span>
          <span className="text-sm font-medium tabular-nums text-foreground/80">
            {startRank}
          </span>
        </div>
        <Sparkline
          data={trajectory.series}
          width={400}
          height={48}
          strokeWidth={1.5}
          className="h-12 flex-1"
          aria-label="30-day solo queue LP trajectory"
        />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            To
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground/90">
            {endRank}
          </span>
        </div>
      </div>
    </section>
  );
}
