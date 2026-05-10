import { EmptyLpHistoryIllustration, EmptyState } from "@/components/empty-state";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import type { LolAccount, RankHistoryPoint } from "@vyoh/shared";
import {
  type DetectedSeason,
  detectSeasons,
  formatRank,
  normalizeLp,
} from "@vyoh/shared/lol/rank-history";
import { m, useReducedMotion } from "motion/react";
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
  const reduced = useReducedMotion();
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
      <m.section
        layout
        initial={reduced ? false : { opacity: 0, y: 16 }}
        whileInView={reduced ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col gap-3 rounded-xl border bg-card/40 p-6"
      >
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
          Rank arc
        </h2>
        <EmptyState
          illustration={<EmptyLpHistoryIllustration />}
          title="Not enough rank snapshots yet"
          hint="Your arc will appear here once Riot's tier/division data builds up."
          className="py-4"
        />
      </m.section>
    );
  }

  const { peak, lpDelta, seasons } = summary;
  const peakLine = formatRank(peak.tier, peak.rank, peak.lp);

  return (
    <m.section
      layout
      initial={reduced ? false : { opacity: 0, y: 32 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-4 rounded-xl border bg-card/40 p-6 sm:p-8"
    >
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
        Rank arc
      </h2>
      <div className="flex flex-col gap-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground/60">
          Your peak
        </p>
        <p className="text-2xl font-semibold text-foreground sm:text-3xl">{peakLine}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {lpDelta !== null && (
          <div className="rounded-lg border border-border/50 bg-background/30 px-4 py-3">
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
              {lpDelta >= 0 ? "+" : ""}
              {lpDelta} LP
            </div>
          </div>
        )}
        <div className="rounded-lg border border-border/50 bg-background/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
            Tracked seasons
          </div>
          <div className="text-xl font-semibold tabular-nums text-foreground/90">
            {seasons.length === 0 ? "1 ongoing" : `${seasons.length} closed`}
          </div>
        </div>
      </div>
    </m.section>
  );
}
