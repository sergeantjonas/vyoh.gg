import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamAchievement, SteamGameAchievements } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompletionVerdictCard } from "./completion-verdict-card";
import { useGameAchievements } from "./use-game-achievements";

vi.mock("./use-game-achievements", () => ({
  useGameAchievements: vi.fn(),
}));

type HookReturn = {
  data: SteamGameAchievements | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useGameAchievements).mockReturnValue(
    value as unknown as ReturnType<typeof useGameAchievements>
  );
}

function makeAchievement(overrides: Partial<SteamAchievement> = {}): SteamAchievement {
  return {
    apiName: "ACH_TEST",
    displayName: "Test",
    description: "",
    hidden: false,
    unlockedAt: null,
    globalPercent: 50,
    ...overrides,
  };
}

function makeData(achievements: SteamAchievement[] | null): SteamGameAchievements {
  return {
    appid: 440,
    achievements,
    lastSchemaCheckedAt: null,
    lastUnlocksCheckedAt: null,
    lastRarityCheckedAt: null,
  };
}

function renderCard(ui: ReactNode) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useGameAchievements).mockReset();
});

// Build N rows, first `unlocked` of which are unlocked, with optional rarity assignment.
function buildRows(
  total: number,
  unlocked: number,
  rarityFor: (i: number) => number | null = () => 50
): SteamAchievement[] {
  return Array.from({ length: total }, (_, i) =>
    makeAchievement({
      apiName: `A${i}`,
      unlockedAt: i < unlocked ? "2026-01-01T00:00:00Z" : null,
      globalPercent: rarityFor(i),
    })
  );
}

describe("CompletionVerdictCard", () => {
  it("renders nothing while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    const { container } = renderCard(<CompletionVerdictCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the schema is null or empty", () => {
    mockHook({ data: makeData(null), isPending: false, isError: false });
    const { container } = renderCard(<CompletionVerdictCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the untouched verdict at 0/total unlocked", () => {
    mockHook({
      data: makeData(buildRows(10, 0)),
      isPending: false,
      isError: false,
    });
    renderCard(<CompletionVerdictCard appid={440} />);
    expect(
      screen.getByText("Owned but untouched on the achievement front.")
    ).toBeTruthy();
  });

  it("renders 'Just getting started' for 1–24%", () => {
    mockHook({ data: makeData(buildRows(10, 1)), isPending: false, isError: false });
    renderCard(<CompletionVerdictCard appid={440} />);
    expect(screen.getByText("Just getting started.")).toBeTruthy();
  });

  it("renders 'Working through it' for 25–49%", () => {
    mockHook({ data: makeData(buildRows(10, 3)), isPending: false, isError: false });
    renderCard(<CompletionVerdictCard appid={440} />);
    expect(screen.getByText("Working through it.")).toBeTruthy();
  });

  it("renders 'Past the halfway mark' for 50–74%", () => {
    mockHook({ data: makeData(buildRows(10, 6)), isPending: false, isError: false });
    renderCard(<CompletionVerdictCard appid={440} />);
    expect(screen.getByText("Past the halfway mark.")).toBeTruthy();
  });

  it("renders 'Closing in' with remaining count for 75–99%", () => {
    mockHook({ data: makeData(buildRows(10, 8)), isPending: false, isError: false });
    renderCard(<CompletionVerdictCard appid={440} />);
    expect(screen.getByText("Closing in — 2 to go.")).toBeTruthy();
  });

  it("renders the 100% verdict when every row is unlocked", () => {
    mockHook({ data: makeData(buildRows(5, 5)), isPending: false, isError: false });
    renderCard(<CompletionVerdictCard appid={440} />);
    expect(screen.getByText("100% complete — every achievement earned.")).toBeTruthy();
  });

  it("emits the rare-only evidence copy when there are rare (<5%) but no very-rare (<1%) unlocks", () => {
    mockHook({
      data: makeData(buildRows(10, 3, (i) => (i < 2 ? 4 : 30))),
      isPending: false,
      isError: false,
    });
    const { container } = renderCard(<CompletionVerdictCard appid={440} />);
    expect(container.textContent).toContain("2 rare");
    expect(container.textContent).toContain("under 5% global");
  });

  it("emits 'rare unlock' singular copy when exactly one rare unlock exists", () => {
    mockHook({
      data: makeData(buildRows(10, 3, (i) => (i === 0 ? 4 : 30))),
      isPending: false,
      isError: false,
    });
    const { container } = renderCard(<CompletionVerdictCard appid={440} />);
    expect(container.textContent).toContain("1 rare");
    expect(container.textContent).toContain("unlock under 5%");
  });

  it("emits very-rare evidence with the leftover rare count", () => {
    mockHook({
      data: makeData(
        buildRows(10, 4, (i) => {
          if (i < 2) return 0.5; // very rare
          if (i < 4) return 3; // rare
          return 30;
        })
      ),
      isPending: false,
      isError: false,
    });
    const { container } = renderCard(<CompletionVerdictCard appid={440} />);
    expect(container.textContent).toContain("2 very rare");
    expect(container.textContent).toContain("2 rare (under 5%)");
  });
});
