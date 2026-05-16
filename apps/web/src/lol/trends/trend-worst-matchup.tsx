// Baseline: personal — pair-level WR among your own matchups; no external comparison.
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_SAMPLE = 3;
const BAN_WR_THRESHOLD = 0.25;
const DISPLAY_COUNT = 3;

interface MatchupRow {
  yourChamp: string;
  oppChamp: string;
  games: number;
  wins: number;
  wr: number;
}

function aggregate(matches: MatchSummary[]): MatchupRow[] {
  const map = new Map<string, MatchupRow>();
  for (const m of matches) {
    if (m.remake) continue;
    if (!m.laneOpponent) continue;
    const key = `${m.champion}::${m.laneOpponent.championName}`;
    const prev = map.get(key) ?? {
      yourChamp: m.champion,
      oppChamp: m.laneOpponent.championName,
      games: 0,
      wins: 0,
      wr: 0,
    };
    map.set(key, {
      ...prev,
      games: prev.games + 1,
      wins: prev.wins + (m.win ? 1 : 0),
    });
  }
  return [...map.values()].map((r) => ({
    ...r,
    wr: r.games === 0 ? 0 : r.wins / r.games,
  }));
}

function MatchupRowView({
  row,
  isWorst,
  accountSlug,
  championName,
}: {
  row: MatchupRow;
  isWorst: boolean;
  accountSlug: string;
  championName: (alias: string) => string;
}) {
  const losses = row.games - row.wins;
  return (
    <div className="flex items-center gap-2 text-xs">
      <Link
        to="/lol/$accountSlug/champions/$championKey"
        params={{ accountSlug, championKey: row.yourChamp.toLowerCase() }}
        className="shrink-0"
      >
        <ChampionSquareIcon
          championName={row.yourChamp}
          className="size-5 shrink-0 rounded-sm opacity-80"
        />
      </Link>
      <span className="text-muted-foreground/60">vs</span>
      <Link
        to="/lol/$accountSlug/champions/$championKey"
        params={{ accountSlug, championKey: row.oppChamp.toLowerCase() }}
        className="shrink-0"
      >
        <ChampionSquareIcon
          championName={row.oppChamp}
          className={`size-5 shrink-0 rounded-sm ${isWorst ? "ring-1 ring-rose-500/50" : ""}`}
        />
      </Link>
      <span className="flex-1 truncate text-foreground/80">
        {championName(row.oppChamp)}
      </span>
      <span className="tabular-nums text-muted-foreground/80">
        <span className="text-emerald-500/80">{row.wins}</span>
        <span className="text-muted-foreground/40">{"–"}</span>
        <span className="text-rose-500/80">{losses}</span>
      </span>
      <span className="w-9 tabular-nums text-right text-muted-foreground/60">
        {Math.round(row.wr * 100)}%
      </span>
    </div>
  );
}

export function TrendWorstMatchup({
  current,
  previous: _previous,
  accountSlug,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
  accountSlug: string;
}) {
  const { rows, sampleSize } = useMemo(() => {
    const filtered = current.filter((m) => !m.remake && m.laneOpponent !== null);
    const aggregated = aggregate(filtered);
    const losing = aggregated
      .filter((r) => r.games >= MIN_SAMPLE && r.wr < 0.5)
      .sort((a, b) => a.wr - b.wr || b.games - a.games)
      .slice(0, DISPLAY_COUNT);
    return { rows: losing, sampleSize: filtered.length };
  }, [current]);

  const championName = useChampionName();

  if (sampleSize === 0) {
    return (
      <ConclusionCard
        title="Worst matchup"
        sampleSize={0}
        verdict="Need Summoner's Rift games for matchup data."
        empty
      />
    );
  }

  if (rows.length === 0) {
    return (
      <ConclusionCard
        title="Worst matchup"
        sampleSize={sampleSize}
        verdict={`No losing matchups with ${MIN_SAMPLE}+ games in this window.`}
        empty
      />
    );
  }

  const worst = rows[0];
  if (!worst) {
    return (
      <ConclusionCard
        title="Worst matchup"
        sampleSize={sampleSize}
        verdict="No matchup data."
        empty
      />
    );
  }

  const losses = worst.games - worst.wins;
  const yourName = championName(worst.yourChamp);
  const oppName = championName(worst.oppChamp);
  const verdict = `${worst.wins}–${losses} on ${yourName} into ${oppName}.`;
  const prescription =
    worst.wr <= BAN_WR_THRESHOLD ? `Consider banning ${oppName}.` : undefined;

  return (
    <ConclusionCard
      title="Worst matchup"
      sampleSize={sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <div className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <MatchupRowView
              key={`${r.yourChamp}-${r.oppChamp}`}
              row={r}
              isWorst={i === 0}
              accountSlug={accountSlug}
              championName={championName}
            />
          ))}
        </div>
      }
    />
  );
}
