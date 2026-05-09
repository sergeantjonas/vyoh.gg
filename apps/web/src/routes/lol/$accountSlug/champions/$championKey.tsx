import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import { championIconUrl } from "@/lol/_shared/champion-icon";
import { ChampionStickyStrip } from "@/lol/_shared/champion-sticky-strip";
import { useHeroScrolledPast } from "@/lol/_shared/use-hero-scrolled-past";
import { ChampionCardChrome, championCardStyle } from "@/lol/champions/champion-card";
import {
  buildWinRateSeries,
  computeChampionDetail,
} from "@/lol/champions/champion-detail-stats";
import { useChampionInfo, useChampionName } from "@/lol/champions/use-champions";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { computeTrendSummary } from "@/lol/trends/trend-stats";
import { createFileRoute } from "@tanstack/react-router";
import { m } from "motion/react";
import { useMemo } from "react";
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
  const { championKey } = Route.useParams();
  const { matches } = useMatchWindow();
  const championName = useChampionName();
  const info = useChampionInfo(championKey);

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
              <div className="relative text-2xl font-bold">{championName(alias)}</div>
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
          <img
            src={championIconUrl(alias)}
            alt=""
            className="size-6 rounded-sm object-cover"
          />
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
    </div>
  );
}
