// Baseline: personal — your deaths bucketed by lane opponent; no external comparison.
import { championSquareIconUrl } from "@/lol/_shared/assets/champion-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear } from "@visx/scale";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_MATCHES = 5;
const MIN_MATCHUP_GAMES = 1;
const MAX_ROWS = 8;

const BUCKET_SEC = 300;
const BUCKETS = 6;

const ICON_COL_W = 96;
const HEADER_H = 18;
const ROW_H = 28;

const TOOLTIP_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

function bucketLabel(i: number): string {
  if (i === BUCKETS - 1) return `${(BUCKETS - 1) * 5}+`;
  return `${i * 5}–${(i + 1) * 5}`;
}

interface MatchupRow {
  championName: string;
  games: number;
  bins: number[];
  totalDeaths: number;
}

function buildRows(matches: readonly MatchSummary[]): MatchupRow[] {
  const map = new Map<string, MatchupRow>();
  for (const m of matches) {
    if (m.remake || !m.laneOpponent || m.csAt10 === 0) continue;
    const opp = m.laneOpponent.championName;
    let row = map.get(opp);
    if (!row) {
      row = {
        championName: opp,
        games: 0,
        bins: new Array<number>(BUCKETS).fill(0),
        totalDeaths: 0,
      };
      map.set(opp, row);
    }
    row.games++;
    for (const ts of m.deathTimings) {
      const idx = Math.min(BUCKETS - 1, Math.floor(ts / BUCKET_SEC));
      const next = (row.bins[idx] ?? 0) + 1;
      row.bins[idx] = next;
      row.totalDeaths++;
    }
  }
  const rows = [...map.values()].filter(
    (r) => r.games >= MIN_MATCHUP_GAMES && r.totalDeaths >= 1
  );
  rows.sort((a, b) => b.games - a.games || b.totalDeaths - a.totalDeaths);
  return rows.slice(0, MAX_ROWS);
}

interface Stats {
  rows: MatchupRow[];
  matchesWithProjection: number;
  maxCellValue: number;
}

function computeStats(matches: readonly MatchSummary[]): Stats {
  const projected = excludeRemakes(matches).filter((m) => m.csAt10 > 0);
  const rows = buildRows(projected);
  let maxCellValue = 0;
  for (const r of rows) {
    for (const v of r.bins) {
      if (v > maxCellValue) maxCellValue = v;
    }
  }
  return { rows, matchesWithProjection: projected.length, maxCellValue };
}

function Heatmap({ rows, maxValue }: { rows: MatchupRow[]; maxValue: number }) {
  const patch = useDDragonVersion();
  return (
    <ParentSize>
      {({ width }) => {
        const innerW = Math.max(0, width - ICON_COL_W);
        const height = HEADER_H + rows.length * ROW_H;

        const xScale = scaleBand<number>({
          domain: Array.from({ length: BUCKETS }, (_, i) => i),
          range: [0, innerW],
          padding: 0.15,
        });

        const yScale = scaleBand<string>({
          domain: rows.map((r) => r.championName),
          range: [0, rows.length * ROW_H],
          padding: 0.18,
        });

        const colorScale = scaleLinear<string>({
          domain: [0, Math.max(1, maxValue)],
          range: ["rgba(244, 63, 94, 0.06)", "rgba(244, 63, 94, 0.85)"],
        });

        return (
          <svg width={width} height={height} role="img" aria-label="Deaths by matchup">
            {/* Minute labels */}
            <Group left={ICON_COL_W} top={0}>
              {Array.from({ length: BUCKETS }, (_, i) => {
                const label = bucketLabel(i);
                return (
                  <text
                    key={label}
                    x={(xScale(i) ?? 0) + xScale.bandwidth() / 2}
                    y={HEADER_H - 5}
                    textAnchor="middle"
                    className="fill-muted-foreground/70 text-[9px] tabular-nums"
                  >
                    {label}
                  </text>
                );
              })}
            </Group>

            {/* Champion icons + names */}
            <Group left={0} top={HEADER_H}>
              {rows.map((row) => {
                const cellTop = yScale(row.championName) ?? 0;
                const cellH = yScale.bandwidth();
                const iconSize = Math.min(cellH, 20);
                const centerY = cellTop + cellH / 2;
                return (
                  <Group key={row.championName}>
                    <image
                      href={championSquareIconUrl(row.championName, patch)}
                      x={2}
                      y={cellTop + (cellH - iconSize) / 2}
                      width={iconSize}
                      height={iconSize}
                      preserveAspectRatio="xMidYMid slice"
                    />
                    <text
                      x={iconSize + 8}
                      y={centerY + 3}
                      className="fill-foreground/80 text-[11px]"
                    >
                      {row.championName.length > 8
                        ? `${row.championName.slice(0, 8)}…`
                        : row.championName}
                    </text>
                    <text
                      x={ICON_COL_W - 6}
                      y={centerY + 3}
                      textAnchor="end"
                      className="fill-muted-foreground/50 text-[9px] tabular-nums"
                    >
                      {row.games}g
                    </text>
                  </Group>
                );
              })}
            </Group>

            {/* Heatmap cells */}
            <Group left={ICON_COL_W} top={HEADER_H}>
              {rows.flatMap((row, _j) =>
                row.bins.map((value, i) => {
                  const x = xScale(i) ?? 0;
                  const y = yScale(row.championName) ?? 0;
                  const w = xScale.bandwidth();
                  const h = yScale.bandwidth();
                  const isEmpty = value === 0;
                  return (
                    <TooltipPrimitive.Root
                      key={`${row.championName}-${i}`}
                      delayDuration={80}
                    >
                      <TooltipPrimitive.Trigger asChild>
                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          rx={2}
                          ry={2}
                          fill={isEmpty ? "transparent" : colorScale(value)}
                          stroke={
                            isEmpty ? "var(--color-border)" : "rgba(244, 63, 94, 0.2)"
                          }
                          strokeOpacity={isEmpty ? 0.4 : 1}
                          strokeWidth={0.5}
                          style={{ cursor: "default" }}
                        />
                      </TooltipPrimitive.Trigger>
                      <TooltipPrimitive.Portal>
                        <TooltipPrimitive.Content
                          side="top"
                          sideOffset={4}
                          className={TOOLTIP_CLASS}
                        >
                          <span className="font-medium">{row.championName}</span>
                          <span className="text-muted-foreground">
                            {" · "}
                            {bucketLabel(i)} min · {value}{" "}
                            {value === 1 ? "death" : "deaths"}
                          </span>
                        </TooltipPrimitive.Content>
                      </TooltipPrimitive.Portal>
                    </TooltipPrimitive.Root>
                  );
                })
              )}
            </Group>
          </svg>
        );
      }}
    </ParentSize>
  );
}

export function TrendDeathMatchupHeatmap({ current }: { current: MatchSummary[] }) {
  const stats = useMemo(() => computeStats(current), [current]);

  if (stats.matchesWithProjection < MIN_MATCHES || stats.rows.length < 3) {
    return (
      <ConclusionCard
        title="Deaths by matchup"
        sampleSize={stats.matchesWithProjection}
        verdict={`Need ${MIN_MATCHES}+ matches with timeline data and at least 3 distinct lane opponents.`}
        empty
      />
    );
  }

  const peakRow = stats.rows.reduce((a, b) => (a.totalDeaths >= b.totalDeaths ? a : b));
  const peakRowDeaths = peakRow.totalDeaths;
  const peakBucketIdx = peakRow.bins.reduce(
    (best, value, i, arr) => ((arr[best] ?? 0) >= value ? best : i),
    0
  );
  const peakBucketLabel = bucketLabel(peakBucketIdx);

  const verdict =
    peakRowDeaths >= 4
      ? `Hardest matchup: ${peakRow.championName} — ${peakRowDeaths} deaths across ${peakRow.games} games, clustered around minutes ${peakBucketLabel}.`
      : "Deaths spread evenly across your matchups — no single opponent dominates the heatmap.";

  return (
    <ConclusionCard
      title="Deaths by matchup"
      sampleSize={stats.matchesWithProjection}
      verdict={verdict}
      verdictMarkdown={verdict}
      evidence={
        <div style={{ height: HEADER_H + stats.rows.length * ROW_H }}>
          <Heatmap rows={stats.rows} maxValue={stats.maxCellValue} />
        </div>
      }
    />
  );
}
