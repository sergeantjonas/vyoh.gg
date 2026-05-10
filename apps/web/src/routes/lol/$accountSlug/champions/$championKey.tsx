import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { ChampionStickyStrip } from "@/lol/_shared/champion-sticky-strip";
import { ItemIcon } from "@/lol/_shared/item-icon";
import { findPatchBoundaries } from "@/lol/_shared/patch-version";
import { useSeriousMatches } from "@/lol/_shared/serious-queues";
import { ThisPatchBadge } from "@/lol/_shared/this-patch-badge";
import { useHeroScrolledPast } from "@/lol/_shared/use-hero-scrolled-past";
import { ChampionCardChrome, championCardStyle } from "@/lol/champions/champion-card";
import {
  buildWinRateSeries,
  computeChampionDetail,
} from "@/lol/champions/champion-detail-stats";
import { ChampionPatchHistory } from "@/lol/champions/champion-patch-history";
import { useChampionExtras } from "@/lol/champions/use-champion-extras";
import { useChampionInfo, useChampionName } from "@/lol/champions/use-champions";
import { useItems } from "@/lol/matches/use-items";
import { computeTrendSummary } from "@/lol/trends/trend-stats";
import { TrendTiltIndicator } from "@/lol/trends/trend-tilt-indicator";
import { TrendTimeHeatmap } from "@/lol/trends/trend-time-heatmap";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { createFileRoute } from "@tanstack/react-router";
import { m } from "motion/react";
import { useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/lol/$accountSlug/champions/$championKey")({
  component: ChampionDetailPage,
});

function DeltaTile({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
}) {
  const isZero = Math.abs(value) < 0.005;
  const positive = value > 0;
  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex flex-1 flex-col gap-1 rounded-lg border bg-card/50 p-4"
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-2xl font-bold tabular-nums",
          isZero
            ? "text-muted-foreground"
            : positive
              ? "text-emerald-400"
              : "text-red-400"
        )}
      >
        {isZero ? "—" : `${positive ? "+" : ""}${format(value)}`}
      </div>
      <div className="text-xs text-muted-foreground">vs. your average</div>
    </m.div>
  );
}

function WinRateTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { game: number } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const { game } = payload[0].payload;
  const wr = payload[0].value;
  return (
    <div className="rounded border bg-popover px-2 py-1 text-xs shadow-md">
      <span className="text-muted-foreground">Game {game}: </span>
      <span className="font-medium">{Math.round(wr * 100)}% WR</span>
    </div>
  );
}

function ChampionDetailPage() {
  const { accountSlug, championKey } = Route.useParams();
  // Champion stats anchor to serious play (KDA/WR are performance reads).
  // Items + matchups still pulled from all queues for v1 — laneOpponent is
  // null on ARAM so matchups auto-filter; item noise from ARAM is mild.
  const { matches } = useSeriousMatches();
  const championName = useChampionName();
  const info = useChampionInfo(championKey);
  const extras = useChampionExtras(accountSlug, championKey);
  const itemsData = useItems();

  const detail = useMemo(
    () => (matches ? computeChampionDetail(championKey, matches) : null),
    [championKey, matches]
  );
  const overall = useMemo(
    () => (matches ? computeTrendSummary(matches) : null),
    [matches]
  );
  const series = useMemo(
    () => (detail ? buildWinRateSeries(detail.matchHistory) : []),
    [detail]
  );
  // detail.matchHistory is already chronological; mirror the same sort here so
  // gameIndex from boundaries lines up with the sparkline's `game` x-axis.
  const championPatchBoundaries = useMemo(() => {
    if (!matches) return [];
    const chrono = matches
      .filter((m) => m.champion.toLowerCase() === championKey.toLowerCase() && !m.remake)
      .slice()
      .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
    return findPatchBoundaries(
      chrono,
      (m) => m.gameVersion,
      (m) => new Date(m.playedAt).getTime()
    );
  }, [matches, championKey]);

  const [matchupSort, setMatchupSort] = useState<"games" | "best" | "hardest">("games");
  const [matchupsExpanded, setMatchupsExpanded] = useState(false);

  const sortedMatchups = useMemo(() => {
    if (!extras.data) return [];
    const list = [...extras.data.matchups];
    if (matchupSort === "best") list.sort((a, b) => b.wins / b.games - a.wins / a.games);
    else if (matchupSort === "hardest")
      list.sort((a, b) => a.wins / a.games - b.wins / b.games);
    return list;
  }, [extras.data, matchupSort]);

  const [stripVisible, heroRef] = useHeroScrolledPast();

  if (!detail) {
    return (
      <m.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-muted-foreground"
      >
        No matches found for {championName(championKey)}.
      </m.p>
    );
  }

  const alias = detail.champion;
  const champMatches = useMemo(
    () => matches?.filter((m) => m.champion === alias) ?? [],
    [matches, alias]
  );
  const kdaDelta = overall ? detail.avgKda - overall.avgKda : null;
  const wrDelta = overall ? detail.winRate - overall.winRate : null;
  const flavorParts = [
    info?.description,
    ...(info?.roles ?? []).map((r) => r.charAt(0).toUpperCase() + r.slice(1)),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/* Hero — fades out when scrolled past header; stays in DOM so no layout shift */}
      <div ref={heroRef}>
        <m.div
          animate={{ opacity: stripVisible ? 0 : 1, y: stripVisible ? -8 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <m.div
            layoutId={`champ-card-${championKey}`}
            style={championCardStyle(alias)}
            className="relative isolate h-52 overflow-hidden rounded-lg border"
          >
            <ChampionCardChrome champion={alias} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="relative flex items-center gap-2">
                <span className="text-2xl font-bold">{championName(alias)}</span>
                {matches && <ThisPatchBadge matches={matches} />}
              </div>
              {flavorParts.length > 0 && (
                <div className="relative text-xs text-muted-foreground/70">
                  {flavorParts.join(" · ")}
                </div>
              )}
              <div className="relative mt-0.5 flex gap-3 text-sm text-muted-foreground">
                <span>
                  <CountUp to={detail.games} /> {detail.games === 1 ? "game" : "games"}
                </span>
                <span>·</span>
                <span
                  className={detail.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"}
                >
                  <CountUp to={Math.round(detail.winRate * 100)} />% WR
                </span>
                <span>·</span>
                <span className="text-amber-400">
                  <CountUp to={detail.avgKda} decimals={2} /> KDA
                </span>
              </div>
            </div>
          </m.div>
        </m.div>
      </div>

      <ChampionStickyStrip
        visible={stripVisible}
        top="var(--account-header-h)"
        championAlias={alias}
      >
        <div className="flex items-center gap-3">
          <ChampionSquareIcon championName={alias} className="size-6 rounded-sm" />
          <span className="text-sm font-medium">{championName(alias)}</span>
          <span
            className={cn(
              "text-xs tabular-nums",
              detail.winRate >= 0.5 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {Math.round(detail.winRate * 100)}% WR
          </span>
          <span className="text-xs tabular-nums text-amber-400">
            {detail.avgKda.toFixed(2)} KDA
          </span>
        </div>
      </ChampionStickyStrip>

      {/* Per-game averages */}
      <m.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="flex gap-4"
      >
        {(
          [
            ["K", detail.avgKills],
            ["D", detail.avgDeaths],
            ["A", detail.avgAssists],
          ] as const
        ).map(([label, val]) => (
          <div
            key={label}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border bg-card/50 py-3"
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              <CountUp to={val} decimals={1} />
            </div>
          </div>
        ))}
      </m.div>

      {/* Delta vs account average */}
      {kdaDelta !== null && wrDelta !== null && (
        <div className="flex gap-4">
          <DeltaTile
            label="KDA"
            value={kdaDelta}
            format={(v) => Math.abs(v).toFixed(2)}
          />
          <DeltaTile
            label="Win Rate"
            value={wrDelta}
            format={(v) => `${Math.round(Math.abs(v) * 100)}%`}
          />
        </div>
      )}

      {/* Win rate trend sparkline — only meaningful with enough games */}
      {series.length >= 5 && (
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.06 }}
          className="flex flex-col gap-2"
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Win Rate Trend
          </div>
          <div className="h-24 rounded-lg border bg-card/50 px-2 py-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <ReferenceLine
                  y={0.5}
                  stroke="currentColor"
                  strokeOpacity={0.15}
                  strokeDasharray="3 3"
                />
                {championPatchBoundaries.map((b) => (
                  <ReferenceLine
                    key={`champ-patch-${b.fromPatch}-${b.toPatch}`}
                    x={b.gameIndex}
                    stroke="currentColor"
                    strokeOpacity={0.18}
                    strokeDasharray="2 3"
                    ifOverflow="hidden"
                    label={{
                      value: b.toPatch,
                      position: "insideTopRight",
                      fill: "var(--muted-foreground)",
                      fontSize: 9,
                    }}
                    className="text-muted-foreground"
                  />
                ))}
                <Tooltip content={<WinRateTooltip />} />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke={detail.winRate >= 0.5 ? "#34d399" : "#f87171"}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </m.div>
      )}

      {/* Per-patch champion WR */}
      <ChampionPatchHistory matches={champMatches} championAlias={alias} />

      {/* Top items */}
      {extras.data && extras.data.topItems.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.08 }}
          className="flex flex-col gap-2"
        >
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Most Built Items
          </div>
          <div className="flex flex-wrap gap-2">
            {extras.data.topItems.map(({ itemId, games, wins }) => {
              const item = itemsData.data?.get(itemId);
              const wr = wins / games;
              return (
                <TooltipPrimitive.Root key={itemId} delayDuration={150}>
                  <TooltipPrimitive.Trigger asChild>
                    <div className="flex cursor-default flex-col items-center gap-1 rounded-lg border bg-card/50 p-2">
                      {item ? (
                        <ItemIcon
                          iconUrl={item.iconUrl}
                          alt={item.name}
                          className="size-10 rounded"
                        />
                      ) : (
                        <div className="size-10 rounded bg-muted/40" />
                      )}
                      <div
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          wr >= 0.5 ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {Math.round(wr * 100)}%
                      </div>
                    </div>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      side="top"
                      sideOffset={6}
                      collisionPadding={8}
                      className="pointer-events-none z-50 w-max max-w-64 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:data-[side=bottom]:animate-in data-[state=delayed-open]:data-[side=top]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                    >
                      <div className="flex items-start gap-3">
                        {item && (
                          <img
                            src={item.iconUrl}
                            alt=""
                            aria-hidden="true"
                            className="size-10 shrink-0 rounded-md bg-muted"
                          />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="text-sm font-semibold leading-tight">
                            {item?.name ?? `Item ${itemId}`}
                          </div>
                          {item?.priceTotal ? (
                            <div className="font-mono text-xs text-amber-400">
                              {item.priceTotal}g
                            </div>
                          ) : null}
                          <div className="text-xs text-muted-foreground">
                            Built in {games} {games === 1 ? "game" : "games"} ·{" "}
                            {Math.round(wr * 100)}% WR
                          </div>
                        </div>
                      </div>
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              );
            })}
          </div>
        </m.div>
      )}

      {/* Matchups */}
      {sortedMatchups.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30, delay: 0.1 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Matchups
            </div>
            <div className="flex gap-1">
              {(["games", "best", "hardest"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMatchupSort(s)}
                  className={cn(
                    "cursor-pointer rounded px-2 py-0.5 text-xs transition-colors",
                    matchupSort === s
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "games" ? "Most played" : s === "best" ? "Best WR" : "Hardest"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(matchupsExpanded ? sortedMatchups : sortedMatchups.slice(0, 8)).map(
              ({ champion, games, wins }) => {
                const wr = wins / games;
                return (
                  <div
                    key={champion}
                    className="flex items-center gap-2 rounded-lg border bg-card/50 px-3 py-2"
                  >
                    <ChampionSquareIcon
                      championName={champion}
                      className="size-7 rounded-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {championName(champion)}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {wins}W {games - wins}L
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        wr >= 0.5 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {Math.round(wr * 100)}%
                    </div>
                  </div>
                );
              }
            )}
          </div>
          {sortedMatchups.length > 8 && (
            <button
              type="button"
              onClick={() => setMatchupsExpanded((v) => !v)}
              className="self-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {matchupsExpanded
                ? "Show less"
                : `Show all ${sortedMatchups.length} matchups`}
            </button>
          )}
        </m.div>
      )}

      <TrendTimeHeatmap current={champMatches} />
      <TrendTiltIndicator current={champMatches} previous={[]} />
    </div>
  );
}
