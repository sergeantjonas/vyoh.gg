import { CountUp } from "@/components/count-up";
import { EmptyChampionIllustration, EmptyState } from "@/components/empty-state";
import { useThemeColor } from "@/lib/use-theme-color";
import { cn } from "@/lib/utils";
import { supportsViewTransitions } from "@/lib/view-transition-nav";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useHeroScrolledPast } from "@/lol/_shared/analytics/use-hero-scrolled-past";
import { championClassIconUrl } from "@/lol/_shared/assets/champion-icon";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { ItemIcon } from "@/lol/_shared/assets/item-icon";
import { ROLE_LABEL, RoleIcon } from "@/lol/_shared/assets/role-icon";
import { findPatchBoundaries } from "@/lol/_shared/patch/patch-version";
import { ThisPatchBadge } from "@/lol/_shared/patch/this-patch-badge";
import {
  filterToSerious,
  useSeriousQueues,
} from "@/lol/_shared/serious-queues/serious-queues";
import { ChampionStickyStrip } from "@/lol/_shared/ui/champion-sticky-strip";
import { WinRateBar } from "@/lol/_shared/ui/win-rate-bar";
import { ChampionBreadcrumb } from "@/lol/champions/champion-breadcrumb";
import { ChampionBuildPath } from "@/lol/champions/champion-build-path";
import { ChampionCardChrome } from "@/lol/champions/champion-card";
import {
  buildWinRateSeries,
  computeChampionDetail,
} from "@/lol/champions/champion-detail-stats";
import { ChampionHero } from "@/lol/champions/champion-hero";
import { ChampionPatchHistory } from "@/lol/champions/champion-patch-history";
import { ChampionPositionHeatmap } from "@/lol/champions/champion-position-heatmap";
import { buildPatchDrift } from "@/lol/champions/patch-drift";
import { useChampionExtras } from "@/lol/champions/use-champion-extras";
import { useChampionInfo, useChampionName } from "@/lol/champions/use-champions";
import { buildWeakestMatchup } from "@/lol/champions/weakest-matchup";
import { useItems } from "@/lol/matches/use-items";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import { TrendDeathMatchupHeatmap } from "@/lol/trends/trend-death-matchup-heatmap";
import { computeTrendSummary } from "@/lol/trends/trend-stats";
import { TrendTiltIndicator } from "@/lol/trends/trend-tilt-indicator";
import { TrendTimeHeatmap } from "@/lol/trends/trend-time-heatmap";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { createFileRoute } from "@tanstack/react-router";
import { formatPlaytimeFromSeconds } from "@vyoh/shared";
import { m } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

// Mirror of MORPH_SETTLE_MS in the match-detail layout — gates body content
// behind the hero's layout-spring (stiffness 170, damping 30) settle time so
// the rect-morph fallback finishes before the rest of the page fades in.
// On VT-supporting browsers the gate is skipped entirely: the OLD snapshot
// freezes the previous DOM until the NEW snapshot is ready, so the body
// content has already painted by the time the user sees real DOM — keeping
// the gate would just dim the page for ~380 ms after the morph finishes.
const MORPH_SETTLE_MS = 700;
const BODY_HOLD_OPACITY = 0.6;

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

// Wide enough to span ~6 patches at any realistic play rate. Decoupled from
// the matches-list count selector so champion stats / sparkline / per-patch
// strip / patch boundaries all read from the same dataset and don't drift
// out of sync depending on the user's matches-list view scope.
const CHAMPION_DETAIL_FETCH_COUNT = 2000;

function ChampionDetailPage() {
  const { accountSlug, championKey } = Route.useParams();
  // Champion stats anchor to serious play (KDA/WR are performance reads).
  // Items + matchups still pulled from all queues for v1 — laneOpponent is
  // null on ARAM so matchups auto-filter; item noise from ARAM is mild.
  const account = useAccountFromSlug(accountSlug);
  const { ids } = useSeriousQueues();
  const { data } = useCachedMatchesWindow(account, CHAMPION_DETAIL_FETCH_COUNT);
  const matches = useMemo(
    () => (data ? filterToSerious(data.matches, ids) : undefined),
    [data, ids]
  );
  const championName = useChampionName();
  useThemeColor(championTheme(championKey).dominantHex);
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

  const weakestMatchup = useMemo(
    () => (extras.data ? buildWeakestMatchup(extras.data.matchups) : null),
    [extras.data]
  );

  const patchDrift = useMemo(
    () => (matches ? buildPatchDrift(matches, detail?.champion ?? championKey) : null),
    [matches, detail?.champion, championKey]
  );

  const [stripVisible, heroRef] = useHeroScrolledPast();

  // Body-settle gate — render the rest of the page at low opacity while the
  // hero morph runs so swapping in cached content mid-flight doesn't visually
  // pop. Mirrors match-detail layout. VT browsers paint the body behind the
  // frozen OLD snapshot and skip the gate; the rect-morph fallback still
  // needs it.
  const [bodyReady, setBodyReady] = useState(() => supportsViewTransitions());
  useEffect(() => {
    if (supportsViewTransitions()) return;
    const id = window.setTimeout(() => setBodyReady(true), MORPH_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Champion-scoped matches must be derived BEFORE the early return — moving
  // it below caused a hooks-count mismatch on first render once the page
  // started self-fetching (data === undefined → detail === null → early
  // return with fewer hooks → next render had one more useMemo → React
  // errored on hooks order). Falls back to championKey when detail isn't
  // available yet so the alias is still resolvable.
  const aliasForFilter = detail?.champion ?? championKey;
  const champMatches = useMemo(
    () =>
      matches?.filter((m) => m.champion.toLowerCase() === aliasForFilter.toLowerCase()) ??
      [],
    [matches, aliasForFilter]
  );

  if (!detail) {
    return (
      <div className="flex flex-col gap-6">
        <ChampionBreadcrumb accountSlug={accountSlug} championAlias={championKey} />
        <EmptyState
          illustration={<EmptyChampionIllustration />}
          title={`No matches on ${championName(championKey)} yet`}
          hint="Play a game with this champion — stats, items, and matchups appear here once data starts flowing."
        />
      </div>
    );
  }

  const alias = detail.champion;
  const kdaDelta = overall ? detail.avgKda - overall.avgKda : null;
  const wrDelta = overall ? detail.winRate - overall.winRate : null;
  // Riot's modern 7-class taxonomy + subclass tier, sourced from the wiki
  // category-page inversion (see api/syncChampionClasses). Parent classes
  // carry the icon + primary weight; subclasses follow in a dimmer chip
  // because wiki has no per-subclass icon set and the visual hierarchy
  // should read "Mage > Burst", not two coequal chips. Falls back to
  // legacy DDragon `roles` only on cold-start before the wiki sync runs.
  const parentClassChips =
    (info?.modernClasses ?? []).length > 0
      ? (info?.modernClasses ?? []).map((c) => ({ slug: c.toLowerCase(), label: c }))
      : (info?.roles ?? []).map((r) => ({
          slug: r.toLowerCase(),
          label: r.charAt(0).toUpperCase() + r.slice(1),
        }));
  const subclassLabels = (info?.modernSubclasses ?? []).map(
    (s) => s.charAt(0).toUpperCase() + s.slice(1)
  );

  return (
    <div className="flex flex-col gap-6">
      <ChampionBreadcrumb accountSlug={accountSlug} championAlias={alias} />
      {/* Hero — fades out when scrolled past header; stays in DOM so no layout shift */}
      <div ref={heroRef}>
        <m.div
          animate={{ opacity: stripVisible ? 0 : 1, y: stripVisible ? -8 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <ChampionHero alias={alias}>
            <ChampionCardChrome champion={alias} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="relative flex items-center gap-2">
                <span className="text-2xl font-bold">{championName(alias)}</span>
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <span className="inline-flex">
                      <RoleIcon
                        position={detail.position}
                        title={ROLE_LABEL[detail.position]}
                        className="size-4 opacity-70"
                      />
                    </span>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content
                      side="bottom"
                      sideOffset={6}
                      className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
                    >
                      Primary lane: {ROLE_LABEL[detail.position]}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
                {champMatches.length > 0 && (
                  <ThisPatchBadge
                    matches={champMatches}
                    label="Last played"
                    buildLabel="Last build"
                  />
                )}
              </div>
              {parentClassChips.length > 0 && (
                <div className="relative mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/70">
                  {parentClassChips.map(({ slug, label }) => (
                    <span
                      key={`class:${slug}`}
                      className="inline-flex items-center gap-1"
                    >
                      <img
                        src={championClassIconUrl(slug)}
                        alt=""
                        aria-hidden={true}
                        className="size-4 shrink-0"
                        draggable={false}
                      />
                      {label}
                    </span>
                  ))}
                  {subclassLabels.length > 0 && (
                    <span className="text-muted-foreground/50">
                      · {subclassLabels.join(" · ")}
                    </span>
                  )}
                </div>
              )}
              <div className="relative mt-0.5 flex gap-3 text-sm text-muted-foreground">
                <span>
                  <CountUp to={detail.games} /> {detail.games === 1 ? "game" : "games"}
                </span>
                <span>·</span>
                <span>{formatPlaytimeFromSeconds(detail.totalDurationSec)}</span>
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
              <WinRateBar winRate={detail.winRate} className="mt-2" />
            </div>
          </ChampionHero>
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

      <m.div
        initial={{ opacity: BODY_HOLD_OPACITY }}
        animate={{ opacity: bodyReady ? 1 : BODY_HOLD_OPACITY }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
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
                  {/* Hidden numeric x-axis so ReferenceLine x={gameIndex}
                    lands at the right fractional position between games.
                    Without this Recharts uses the array index as the X
                    domain (0-based) and our boundary's 1-based gameIndex
                    falls one game too far right. */}
                  <XAxis
                    dataKey="game"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    hide
                  />
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
                      strokeOpacity={0.45}
                      strokeDasharray="2 3"
                      ifOverflow="hidden"
                      label={{
                        value: b.toPatch,
                        position: "insideTopRight",
                        fill: "var(--muted-foreground)",
                        fontSize: 10,
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

        {patchDrift && (
          <div className="flex flex-col gap-1 rounded-lg border bg-card/40 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              Time on this champion
            </div>
            <div className="text-sm leading-snug text-foreground/90">
              {patchDrift.direction === "up" ? "Up" : "Down"} on patch{" "}
              {patchDrift.currentPatch} — {Math.round(patchDrift.currentShare * 100)}% of
              your {patchDrift.currentTotalGames} games (vs{" "}
              {Math.round(patchDrift.previousShare * 100)}% on {patchDrift.previousPatch}
              ).{" "}
              <span className="text-muted-foreground/70">
                {patchDrift.currentChampGames} games this patch
              </span>
            </div>
          </div>
        )}
        {/* Per-patch champion WR — feeds off the page's wider matches window so
          the strip's 6-patch tail and the hero summary are derived from the
          same dataset (was drifting when the strip self-fetched 2000 matches
          but the page used the bounded count selector). */}
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
            {weakestMatchup && (
              <div
                className={cn(
                  "flex flex-col gap-1 rounded-lg border px-3 py-2.5",
                  weakestMatchup.deltaPP >= 15
                    ? "border-rose-500/40 bg-rose-500/10"
                    : "border-border bg-card/40"
                )}
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  Weakest matchup
                </div>
                <div className="text-sm leading-snug text-foreground/90">
                  vs {championName(weakestMatchup.champion)} —{" "}
                  {Math.round(weakestMatchup.wr * 100)}% WR, {weakestMatchup.deltaPP}pp
                  below your {Math.round(weakestMatchup.baselineWr * 100)}% baseline on
                  this champion.{" "}
                  <span className="text-muted-foreground/70">
                    {weakestMatchup.games} games
                  </span>
                </div>
              </div>
            )}
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
                className="cursor-pointer self-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {matchupsExpanded
                  ? "Show less"
                  : `Show all ${sortedMatchups.length} matchups`}
              </button>
            )}
          </m.div>
        )}

        <ChampionBuildPath accountSlug={accountSlug} championKey={championKey} />
        <ChampionPositionHeatmap matches={champMatches} />
        <TrendDeathMatchupHeatmap current={champMatches} />
        <TrendTimeHeatmap current={champMatches} />
        <TrendTiltIndicator current={champMatches} previous={[]} />
      </m.div>
    </div>
  );
}
