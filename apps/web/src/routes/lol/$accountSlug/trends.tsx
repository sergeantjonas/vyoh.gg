import { EmptyMatchesIllustration, EmptyState } from "@/components/empty-state";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { TrendChampionFocus } from "@/lol/trends/trend-champion-focus";
import { TrendComebackResilience } from "@/lol/trends/trend-comeback-resilience";
import { TrendDamageRoleConsistency } from "@/lol/trends/trend-damage-role-consistency";
import { TrendDeathTiming } from "@/lol/trends/trend-death-timing";
import { TrendDowWr } from "@/lol/trends/trend-dow-wr";
import { TrendFirstBloodConversion } from "@/lol/trends/trend-first-blood-conversion";
import { TrendGameLength } from "@/lol/trends/trend-game-length";
import { TrendKda } from "@/lol/trends/trend-kda";
import { TrendLanePhasePrognosis } from "@/lol/trends/trend-lane-phase-prognosis";
import { TrendLpEconomy } from "@/lol/trends/trend-lp-economy";
import { TrendRolePerformance } from "@/lol/trends/trend-role-performance";
import { TrendSessionFatigue } from "@/lol/trends/trend-session-fatigue";
import { TrendTiltIndicator } from "@/lol/trends/trend-tilt-indicator";
import { TrendTimeHeatmap } from "@/lol/trends/trend-time-heatmap";
import { TrendVisionInvestment } from "@/lol/trends/trend-vision-investment";
import { TrendWeeklyReview } from "@/lol/trends/trend-weekly-review";
import { TrendWorstMatchup } from "@/lol/trends/trend-worst-matchup";
import { TrendWrTrajectory } from "@/lol/trends/trend-wr-trajectory";
import { TrendsRangeSelector } from "@/lol/trends/trends-range-selector";
import type { TrendsRangeId } from "@/lol/trends/trends-range-selector";
import { TrendsSkeleton } from "@/lol/trends/trends-skeleton";
import { useTrendsWindows } from "@/lol/trends/use-trends-windows";
import { createFileRoute } from "@tanstack/react-router";
import { type MatchSummary, excludeRemakes } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/lol/$accountSlug/trends")({
  component: TrendsPage,
});

// Grid cell wrapper: handles scroll-reveal entrance + layout reflow.
function Cell({
  children,
  span,
}: {
  children: ReactNode;
  span?: 3 | 2 | 1;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      layout
      className={span === 3 ? "md:col-span-3" : span === 2 ? "md:col-span-2" : undefined}
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </m.div>
  );
}

interface Tile {
  id: string;
  span: 3 | 2 | 1;
  designPriority: number;
  active: boolean;
  node: ReactNode;
}

const INACTIVE_PENALTY = 1000;

function buildTiles(
  current: MatchSummary[],
  previous: MatchSummary[],
  accountSlug: string
): Tile[] {
  const played = excludeRemakes(current);
  const playedRift = played.filter((m) => m.teamPosition !== "");
  const playedWithOpponent = played.filter((m) => m.laneOpponent !== null);
  const playedWithLp = played.filter((m) => m.snapshotLp !== undefined);

  return [
    {
      id: "weekly",
      span: 3,
      designPriority: 1000,
      active: played.length >= 1,
      node: <TrendWeeklyReview current={current} />,
    },
    {
      id: "time-heatmap",
      span: 3,
      designPriority: 800,
      active: played.length >= 5,
      node: <TrendTimeHeatmap current={current} />,
    },
    {
      id: "wr-trajectory",
      span: 2,
      designPriority: 720,
      active: played.length >= 20,
      node: <TrendWrTrajectory current={current} previous={previous} />,
    },
    {
      id: "dow-wr",
      span: 2,
      designPriority: 710,
      active: played.length >= 7,
      node: <TrendDowWr current={current} previous={previous} />,
    },
    {
      id: "role-performance",
      span: 2,
      designPriority: 700,
      active: playedRift.length >= 3,
      node: <TrendRolePerformance current={current} previous={previous} />,
    },
    {
      id: "tilt",
      span: 1,
      designPriority: 600,
      active: played.length >= 10,
      node: <TrendTiltIndicator current={current} previous={previous} />,
    },
    {
      id: "game-length",
      span: 1,
      designPriority: 590,
      active: played.length >= 5,
      node: <TrendGameLength current={current} previous={previous} />,
    },
    {
      id: "champion-focus",
      span: 1,
      designPriority: 580,
      active: played.length >= 1,
      node: (
        <TrendChampionFocus
          current={current}
          previous={previous}
          accountSlug={accountSlug}
        />
      ),
    },
    {
      id: "lp-economy",
      span: 1,
      designPriority: 570,
      active: playedWithLp.length >= 1,
      node: <TrendLpEconomy current={current} previous={previous} />,
    },
    {
      id: "session-fatigue",
      span: 1,
      designPriority: 510,
      active: played.length >= 5,
      node: <TrendSessionFatigue current={current} previous={previous} />,
    },
    {
      id: "worst-matchup",
      span: 1,
      designPriority: 500,
      active: playedWithOpponent.length >= 3,
      node: (
        <TrendWorstMatchup
          current={current}
          previous={previous}
          accountSlug={accountSlug}
        />
      ),
    },
    {
      id: "damage-role-consistency",
      span: 1,
      designPriority: 460,
      active: playedRift.length >= 5,
      node: <TrendDamageRoleConsistency current={current} previous={previous} />,
    },
    {
      id: "vision-investment",
      span: 1,
      designPriority: 450,
      active: playedRift.length >= 5,
      node: <TrendVisionInvestment current={current} previous={previous} />,
    },
    {
      id: "first-blood-conversion",
      span: 1,
      designPriority: 440,
      active: played.length >= 5,
      node: <TrendFirstBloodConversion current={current} previous={previous} />,
    },
    {
      id: "lane-phase-prognosis",
      span: 1,
      designPriority: 430,
      active: playedRift.filter((m) => m.csAt10 > 0).length >= 5,
      node: <TrendLanePhasePrognosis current={current} previous={previous} />,
    },
    {
      id: "death-timing",
      span: 2,
      designPriority: 420,
      active: played.filter((m) => m.csAt10 > 0).length >= 5,
      node: <TrendDeathTiming current={current} previous={previous} />,
    },
    {
      id: "comeback-resilience",
      span: 1,
      designPriority: 410,
      active: played.filter((m) => m.teamGoldDiffAt15 <= -5000).length >= 5,
      node: <TrendComebackResilience current={current} previous={previous} />,
    },
    {
      id: "kda",
      span: 3,
      designPriority: 400,
      active: played.length >= 1,
      node: <TrendKda current={current} previous={previous} />,
    },
  ];
}

function TrendsPage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const [rangeId, setRangeId] = useState<TrendsRangeId>("30d");
  const { current, previous, isPending } = useTrendsWindows(rangeId, account);

  const sortedTiles = useMemo(() => {
    const tiles = buildTiles(current, previous, accountSlug);
    return tiles
      .map((t) => ({
        ...t,
        priority: t.active ? t.designPriority : t.designPriority - INACTIVE_PENALTY,
      }))
      .sort((a, b) => b.priority - a.priority);
  }, [current, previous, accountSlug]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Trends</h2>
        <TrendsRangeSelector value={rangeId} onChange={setRangeId} />
      </div>

      {isPending && current.length === 0 ? (
        <TrendsSkeleton />
      ) : current.length === 0 ? (
        <EmptyState
          illustration={<EmptyMatchesIllustration />}
          title="No matches in this window yet"
          hint="Try a wider range, or check back once the next sync runs."
        />
      ) : (
        <m.div
          layout
          className="grid grid-cols-1 gap-4 md:grid-flow-row-dense md:grid-cols-3"
        >
          {sortedTiles.map((tile) => (
            <Cell key={tile.id} span={tile.span}>
              {tile.node}
            </Cell>
          ))}
        </m.div>
      )}
    </div>
  );
}
