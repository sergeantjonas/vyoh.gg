import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import type { MatchSummary } from "@vyoh/shared";
import { hexbin as d3Hexbin } from "d3-hexbin";
import { useMemo, useState } from "react";

// Sqrt opacity scale: peaks pop without burying the map under a solid wash
// of color. Floor is intentionally near-zero so single-event hexes stay
// almost invisible and the SR landmarks read through.
const OPACITY_FLOOR = 0.04;
const OPACITY_CEIL = 0.85;

const MIN_MATCHES_WITH_POSITION = 5;

// Raw 720px wsrv variant of CDragon's `2dlevelminimap_npe_1.png`. Same asset
// the match-map-overlay already uses, so the browser cache hits across both
// surfaces.
const MINIMAP_URL =
  "https://wsrv.nl/?url=raw.communitydragon.org/latest/game/assets/maps/info/map11/2dlevelminimap_npe_1.png&w=720&output=webp";

// Riot's CHAMPION_KILL positions are in 0–15000 game-space, with Y *not*
// inverted relative to SVG. We flip at render time (`RIFT_MAX - y`) so the
// DB stays a faithful mirror of Riot data.
const RIFT_MAX = 15000;

// Hex radius in game-coord space. ~500 yields ~30 cells across at the card
// size, small enough that peaks resolve to one or two bright cells without
// the grid feeling pixelated. Tunable.
const HEX_RADIUS = 500;

const TOOLTIP_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

type Mode = "deaths" | "kills";

interface Point {
  x: number;
  y: number;
}

interface Stats {
  points: Point[];
  matchesWithPosition: number;
  totalMatches: number;
  zoneCounts: Map<string, number>;
}

// Rough zone classifier in raw Riot game-coords (0–15000, Y not flipped).
// Pits checked first because they're small and override the diagonal/lane
// rules. Lanes are L-shaped — the band along the diagonal is mid, and the
// outer edges (low x / high y for top, high x / low y for bot) cover the
// vertical-then-horizontal lane shape. Everything else falls through to
// "jungle/river" — fine enough for a verdict; finer distinctions would
// need team-side normalization (we'd have to track which side the user
// played per match to call something "your jungle").
function classifyZone(x: number, y: number): string {
  if (Math.hypot(x - 9866, y - 4414) < 1800) return "dragon pit";
  if (Math.hypot(x - 4979, y - 10471) < 1800) return "baron pit";
  const midDist = Math.abs(x - y) / Math.SQRT2;
  if (midDist < 1700) return "mid lane";
  if (x < 3000 || y > 12000) return "top lane";
  if (x > 12000 || y < 3000) return "bot lane";
  return "the jungle";
}

function collectStats(matches: readonly MatchSummary[], mode: Mode): Stats {
  const points: Point[] = [];
  const zoneCounts = new Map<string, number>();
  let matchesWithPosition = 0;
  let totalMatches = 0;
  for (const m of matches) {
    if (m.remake) continue;
    totalMatches++;
    const xs = mode === "deaths" ? m.deathXs : m.killXs;
    const ys = mode === "deaths" ? m.deathYs : m.killYs;
    if (xs.length === 0) continue;
    matchesWithPosition++;
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const y = ys[i];
      if (x === undefined || y === undefined) continue;
      const zone = classifyZone(x, y);
      zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
      // Flip Y *after* classifying so the classifier reads raw Riot coords
      // (matches the constants above). Downstream renderers want SVG-space.
      points.push({ x, y: RIFT_MAX - y });
    }
  }
  return { points, zoneCounts, matchesWithPosition, totalMatches };
}

function buildVerdict(
  zoneCounts: Map<string, number>,
  totalEvents: number,
  noun: string
): string {
  if (totalEvents === 0) return `No ${noun}s recorded yet on this champion.`;
  const sorted = [...zoneCounts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  if (!top) return `No ${noun}s recorded yet on this champion.`;
  const [topZone, topCount] = top;
  const topShare = topCount / totalEvents;

  if (topShare >= 0.45) {
    return `Most ${noun}s land around ${topZone} — ${Math.round(topShare * 100)}% of the total.`;
  }
  const second = sorted[1];
  if (second && (topCount + second[1]) / totalEvents >= 0.55) {
    return `${noun[0]?.toUpperCase()}${noun.slice(1)}s cluster around ${topZone} and ${second[0]}.`;
  }
  return `${noun[0]?.toUpperCase()}${noun.slice(1)}s are spread across the map — no single zone dominates.`;
}

function HexHeatmap({
  points,
  mode,
  totalEvents,
}: {
  points: Point[];
  mode: Mode;
  totalEvents: number;
}) {
  return (
    <ParentSize>
      {({ width }) => {
        if (width <= 0) return null;
        // Pin to a square — the SR minimap and Riot's coord grid are both
        // 1:1, so anything else introduces letterboxing we'd have to handle.
        const size = width;

        // Scale game-coords (0–15000) to pixel-coords (0–size). Single
        // scale used for both axes since the map is square.
        const scale = scaleLinear<number>({ domain: [0, RIFT_MAX], range: [0, size] });

        const pxRadius = (HEX_RADIUS / RIFT_MAX) * size;

        // d3-hexbin operates in pixel space. Project then bin.
        const projected = points.map<[number, number]>((p) => [scale(p.x), scale(p.y)]);
        const bin = d3Hexbin<[number, number]>()
          .radius(pxRadius)
          .extent([
            [0, 0],
            [size, size],
          ]);
        const bins = bin(projected);
        const maxCount = bins.reduce((m, b) => Math.max(m, b.length), 0);

        // Sqrt opacity scale: low counts stay near-transparent so the map
        // reads through, peaks pop without being overwhelming. Hue switches
        // by mode but the alpha curve is the same.
        const opacityScale = scaleLinear<number>({
          domain: [0, Math.sqrt(Math.max(1, maxCount))],
          range: [OPACITY_FLOOR, OPACITY_CEIL],
          clamp: true,
        });
        const rgb = mode === "deaths" ? "244, 63, 94" : "52, 211, 153";
        const hexFill = (count: number) =>
          `rgba(${rgb}, ${opacityScale(Math.sqrt(count)).toFixed(3)})`;

        const hexPath = bin.hexagon();
        const noun = mode === "deaths" ? "death" : "kill";

        return (
          <div className="relative" style={{ width: size, height: size }}>
            {/* Dimmed minimap. object-contain matches the SVG's identity
                projection (both pinned to a square) so hex centers land on
                the right lane / objective. */}
            <img
              src={MINIMAP_URL}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full select-none object-contain opacity-85"
              draggable={false}
            />
            <svg
              width={size}
              height={size}
              className="absolute inset-0"
              role="img"
              aria-label={`${noun} positions on Summoner's Rift — ${totalEvents} total`}
            >
              {bins.map((b) => (
                <TooltipPrimitive.Root
                  key={`${Math.round(b.x)}-${Math.round(b.y)}`}
                  delayDuration={80}
                >
                  <TooltipPrimitive.Trigger asChild>
                    <path
                      d={hexPath}
                      transform={`translate(${b.x},${b.y})`}
                      fill={hexFill(b.length)}
                      style={{ cursor: "default" }}
                    />
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      side="top"
                      sideOffset={4}
                      className={TOOLTIP_CLASS}
                    >
                      <span className="font-medium tabular-nums">{b.length}</span>{" "}
                      <span className="text-muted-foreground">
                        {b.length === 1 ? noun : `${noun}s`}
                      </span>
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              ))}
            </svg>
          </div>
        );
      }}
    </ParentSize>
  );
}

function ModeToggle({
  mode,
  onModeChange,
}: {
  mode: Mode;
  onModeChange: (next: Mode) => void;
}) {
  return (
    <div className="flex gap-1">
      {(["deaths", "kills"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onModeChange(m)}
          className={
            mode === m
              ? "cursor-pointer rounded bg-foreground/10 px-2 py-0.5 text-xs text-foreground transition-colors"
              : "cursor-pointer rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {m === "deaths" ? "Deaths" : "Kills"}
        </button>
      ))}
    </div>
  );
}

export function ChampionPositionHeatmap({ matches }: { matches: MatchSummary[] }) {
  const [mode, setMode] = useState<Mode>("deaths");
  const stats = useMemo(() => collectStats(matches, mode), [matches, mode]);

  if (stats.matchesWithPosition < MIN_MATCHES_WITH_POSITION) {
    return (
      <ConclusionCard
        title="Rift position heatmap"
        sampleSize={stats.matchesWithPosition}
        verdict={`Need ${MIN_MATCHES_WITH_POSITION}+ Rift matches with timeline data on this champion before a heatmap is meaningful.`}
        empty
      />
    );
  }

  const noun = mode === "deaths" ? "death" : "kill";
  const verdict = buildVerdict(stats.zoneCounts, stats.points.length, noun);

  return (
    <ConclusionCard
      title="Rift position heatmap"
      sampleSize={stats.matchesWithPosition}
      verdict={verdict}
      verdictMarkdown={verdict}
      evidence={
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <ModeToggle mode={mode} onModeChange={setMode} />
          </div>
          <div className="mx-auto w-full max-w-md">
            <HexHeatmap
              points={stats.points}
              mode={mode}
              totalEvents={stats.points.length}
            />
          </div>
        </div>
      }
    />
  );
}
