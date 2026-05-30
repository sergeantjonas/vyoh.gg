import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { RankEntry } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { HeroRankStrip } from "./hero-rank-strip";

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <TooltipPrimitive.Provider>
        <MotionConfig reducedMotion="always">{ui}</MotionConfig>
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
}

function entry(overrides: Partial<RankEntry> = {}): RankEntry {
  return {
    queueId: "RANKED_SOLO_5x5",
    tier: "EMERALD",
    rank: "I",
    leaguePoints: 17,
    wins: 15,
    losses: 12,
    hotStreak: false,
    ...overrides,
  };
}

function renderStrip(
  entries: RankEntry[],
  recentLpByQueue?: Record<string, number[]>,
  compact = false
) {
  return render(
    wrap(
      <HeroRankStrip
        entries={entries}
        recentLpByQueue={recentLpByQueue}
        compact={compact}
      />
    )
  );
}

describe("HeroRankStrip", () => {
  it("renders a ranked queue: tier, LP, and W/L · win%", () => {
    renderStrip([entry()]);
    expect(screen.getByText("Emerald I")).toBeTruthy();
    expect(screen.getByText("17 LP")).toBeTruthy();
    // 15W / 27 games = 56%.
    expect(screen.getByText("15W 12L · 56%")).toBeTruthy();
  });

  it("drops the division for apex tiers", () => {
    renderStrip([entry({ tier: "MASTER", rank: "I", leaguePoints: 320 })]);
    expect(screen.getByText("Master")).toBeTruthy();
    expect(screen.queryByText("Master I")).toBeNull();
  });

  it("keeps both queue columns, rendering Unranked for the missing one", () => {
    renderStrip([entry({ queueId: "RANKED_SOLO_5x5" })]);
    // Solo is Emerald; Flex is absent → one Unranked placeholder.
    expect(screen.getByText("Emerald I")).toBeTruthy();
    expect(screen.getAllByText("Unranked")).toHaveLength(1);
  });

  it("renders both queues when both are ranked", () => {
    renderStrip([
      entry({
        queueId: "RANKED_SOLO_5x5",
        tier: "DIAMOND",
        rank: "II",
        leaguePoints: 44,
      }),
      entry({ queueId: "RANKED_FLEX_SR", tier: "GOLD", rank: "IV", leaguePoints: 5 }),
    ]);
    expect(screen.getByText("Diamond II")).toBeTruthy();
    expect(screen.getByText("Gold IV")).toBeTruthy();
    expect(screen.queryByText("Unranked")).toBeNull();
  });

  it("renders the LP sparkline only when there are >=5 trend points", () => {
    const { container, rerender } = renderStrip([entry()], {
      RANKED_SOLO_5x5: [10, 20, 30, 40],
    });
    expect(container.querySelector("svg")).toBeNull();
    rerender(
      wrap(
        <HeroRankStrip
          entries={[entry()]}
          recentLpByQueue={{ RANKED_SOLO_5x5: [10, 20, 30, 40, 50] }}
          compact={false}
        />
      )
    );
    expect(container.querySelector('svg[aria-label*="LP trend"]')).toBeTruthy();
  });

  it("surfaces the hot-streak flame for a hot-streak queue", () => {
    const { container } = renderStrip([entry({ hotStreak: true })]);
    // lucide Flame renders as an svg with the lucide-flame class.
    expect(container.querySelector("svg.lucide-flame")).toBeTruthy();
  });
});
