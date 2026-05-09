import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { TrendGameLength } from "@/lol/trends/trend-game-length";
import { TrendKda } from "@/lol/trends/trend-kda";
import { TrendPoolEntropy } from "@/lol/trends/trend-pool-entropy";
import { TrendTiltIndicator } from "@/lol/trends/trend-tilt-indicator";
import { TrendTimeHeatmap } from "@/lol/trends/trend-time-heatmap";
import { TrendWeeklyReview } from "@/lol/trends/trend-weekly-review";
import { TrendsRangeSelector } from "@/lol/trends/trends-range-selector";
import type { TrendsRangeId } from "@/lol/trends/trends-range-selector";
import { TrendsSkeleton } from "@/lol/trends/trends-skeleton";
import { useTrendsWindows } from "@/lol/trends/use-trends-windows";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { m, useReducedMotion } from "motion/react";
import { useState } from "react";
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

function TrendsPage() {
  const { accountSlug } = Route.useParams();
  const { queue } = useSearch({ from: "/lol/$accountSlug" });
  const account = useAccountFromSlug(accountSlug);
  const [rangeId, setRangeId] = useState<TrendsRangeId>("30d");
  const { current, previous, isPending } = useTrendsWindows(rangeId, account, queue);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Trends</h2>
        <TrendsRangeSelector value={rangeId} onChange={setRangeId} />
      </div>

      {isPending && current.length === 0 ? (
        <TrendsSkeleton />
      ) : current.length === 0 ? (
        <m.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-muted-foreground"
        >
          No matches in this window yet.
        </m.p>
      ) : (
        <m.div layout className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Cell span={3}>
            <TrendWeeklyReview current={current} />
          </Cell>
          <Cell span={3}>
            <TrendTimeHeatmap current={current} />
          </Cell>
          <Cell>
            <TrendTiltIndicator current={current} previous={previous} />
          </Cell>
          <Cell>
            <TrendGameLength current={current} previous={previous} />
          </Cell>
          <Cell>
            <TrendPoolEntropy current={current} previous={previous} />
          </Cell>
          <Cell span={3}>
            <TrendKda current={current} previous={previous} />
          </Cell>
        </m.div>
      )}
    </div>
  );
}
