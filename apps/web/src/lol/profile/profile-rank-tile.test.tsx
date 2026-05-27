import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { RankEntry } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { ProfileRankTiles } from "./profile-rank-tile";

function entry(overrides: Partial<RankEntry> = {}): RankEntry {
  return {
    queueId: "RANKED_SOLO_5x5",
    tier: "GOLD",
    rank: "II",
    leaguePoints: 75,
    wins: 30,
    losses: 20,
    hotStreak: false,
    ...overrides,
  } as RankEntry;
}

function renderTiles(entries: RankEntry[], recentLpByQueue?: Record<string, number[]>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <ProfileRankTiles entries={entries} recentLpByQueue={recentLpByQueue} />
      </MotionConfig>
    </QueryClientProvider>
  );
}

describe("ProfileRankTiles", () => {
  it("renders unranked placeholders when entries is empty", () => {
    renderTiles([]);
    const unranked = screen.getAllByText("Unranked");
    expect(unranked.length).toBe(2);
    expect(screen.getByText("Ranked Solo")).toBeTruthy();
    expect(screen.getByText("Ranked Flex")).toBeTruthy();
  });

  it("renders the tier label, division, LP, and W/L line", () => {
    renderTiles([entry()]);
    expect(screen.getByText(/Gold/)).toBeTruthy();
    expect(screen.getByText(/II/)).toBeTruthy();
    expect(screen.getByText("75 LP")).toBeTruthy();
    // 30W 20L → 60% WR.
    expect(screen.getByText(/30W 20L · 60%/)).toBeTruthy();
  });

  it("omits the division text for apex tiers (MASTER+)", () => {
    renderTiles([entry({ tier: "MASTER", rank: "I", leaguePoints: 250 })]);
    const tier = screen.getByText(/Master/);
    expect(tier.textContent?.trim()).toBe("Master");
  });

  it("renders both queues independently when one is ranked and the other is missing", () => {
    renderTiles([entry({ queueId: "RANKED_FLEX_SR", tier: "PLATINUM", rank: "IV" })]);
    expect(screen.getByText("Unranked")).toBeTruthy();
    expect(screen.getByText(/Platinum/)).toBeTruthy();
  });

  it("omits the W/L line when wins/losses are null", () => {
    const { container } = renderTiles([
      entry({ wins: null, losses: null } as unknown as Partial<RankEntry>),
    ]);
    expect(container.textContent).not.toMatch(/\dW \dL/);
  });

  it("renders the LP trend sparkline when recentLpByQueue carries >=5 points", () => {
    const { container } = renderTiles([entry()], {
      RANKED_SOLO_5x5: [1200, 1215, 1230, 1245, 1260, 1275],
    });
    const sparkline = container.querySelector('[data-slot="sparkline"]');
    expect(sparkline).toBeTruthy();
    expect(sparkline?.getAttribute("aria-label")).toMatch(/LP trend/);
  });

  it("omits the LP trend sparkline when the queue has fewer than 5 points", () => {
    const { container } = renderTiles([entry()], {
      RANKED_SOLO_5x5: [1200, 1215, 1230, 1245],
    });
    expect(container.querySelector('[data-slot="sparkline"]')).toBeNull();
  });
});
