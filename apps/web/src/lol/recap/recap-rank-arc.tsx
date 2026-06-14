import { EmptyLpHistoryIllustration, EmptyState } from "@/components/empty-state";
import { ChapterLabel } from "@/components/ui/chapter-label";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import { ChapterShell } from "@/lol/recap/chapter-shell";
import { type LolAccount, type RankHistoryPoint, formatLpDelta } from "@vyoh/shared";
import {
  type DetectedSeason,
  detectSeasons,
  formatRank,
  normalizeLp,
} from "@vyoh/shared/lol/rank-history";
import { useMemo } from "react";

interface PeakInfo {
  tier: string;
  rank: string;
  lp: number;
  total: number;
}

function findPeak(points: RankHistoryPoint[]): PeakInfo | null {
  if (points.length === 0) return null;
  let best: PeakInfo | null = null;
  for (const p of points) {
    const total = normalizeLp(p.tier, p.rank, p.leaguePoints);
    if (!best || total > best.total) {
      best = { tier: p.tier, rank: p.rank, lp: p.leaguePoints, total };
    }
  }
  return best;
}

export function RecapRankArc({ account }: { account: LolAccount | undefined }) {
  const { data } = useRankHistory(account, "season");

  const summary = useMemo(() => {
    if (!data) return null;
    const all = [...data.solo, ...data.flex];
    if (all.length === 0) return null;
    const peakSolo = findPeak(data.solo);
    const peakFlex = findPeak(data.flex);
    const peak =
      peakSolo && peakFlex
        ? peakSolo.total >= peakFlex.total
          ? peakSolo
          : peakFlex
        : (peakSolo ?? peakFlex);
    const sortedSolo = [...data.solo].sort((a, b) =>
      a.capturedAt.localeCompare(b.capturedAt)
    );
    const firstSolo = sortedSolo[0];
    const lastSolo = sortedSolo[sortedSolo.length - 1];
    const lpDelta =
      firstSolo && lastSolo
        ? normalizeLp(lastSolo.tier, lastSolo.rank, lastSolo.leaguePoints) -
          normalizeLp(firstSolo.tier, firstSolo.rank, firstSolo.leaguePoints)
        : null;
    const seasons: DetectedSeason[] = detectSeasons(all);
    return { peak, lpDelta, seasons };
  }, [data]);

  if (!summary || !summary.peak) {
    return (
      <ChapterShell>
        <ChapterLabel>Rank arc</ChapterLabel>
        <EmptyState
          illustration={<EmptyLpHistoryIllustration />}
          title="Not enough rank snapshots yet"
          hint="Your arc will appear here once Riot's tier/division data builds up."
          className="py-4"
        />
      </ChapterShell>
    );
  }

  const { peak, lpDelta, seasons } = summary;
  const peakLine = formatRank(peak.tier, peak.rank, peak.lp);

  return (
    <ChapterShell populated>
      <ChapterLabel>Rank arc</ChapterLabel>
      <div className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground/60">
          Your peak
        </p>
        <p className="text-2xl font-semibold text-foreground sm:text-3xl recap-wght-settle">
          {peakLine}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {lpDelta !== null && (
          <div className="rounded-lg border border-border/50 bg-card/50 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
              Net LP movement (Solo)
            </div>
            <div
              className={
                lpDelta >= 0
                  ? "text-xl font-semibold tabular-nums text-emerald-400"
                  : "text-xl font-semibold tabular-nums text-rose-400"
              }
            >
              {formatLpDelta(lpDelta)} LP
            </div>
          </div>
        )}
        <div className="rounded-lg border border-border/50 bg-card/50 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
            Tracked seasons
          </div>
          <div className="text-xl font-semibold tabular-nums text-foreground/90">
            {seasons.length === 0 ? "1 ongoing" : `${seasons.length} closed`}
          </div>
        </div>
      </div>
    </ChapterShell>
  );
}
