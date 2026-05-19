import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamAchievement, SteamGameAchievements } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RarestUnlockCard } from "./rarest-unlock-card";
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
    displayName: "Test Achievement",
    description: "Do the test thing.",
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

describe("RarestUnlockCard", () => {
  it("renders nothing while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    const { container } = renderCard(<RarestUnlockCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the game has no schema (achievements === null)", () => {
    mockHook({ data: makeData(null), isPending: false, isError: false });
    const { container } = renderCard(<RarestUnlockCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no row has been unlocked", () => {
    mockHook({
      data: makeData([makeAchievement({ globalPercent: 0.5 })]),
      isPending: false,
      isError: false,
    });
    const { container } = renderCard(<RarestUnlockCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the only unlocked row has no globalPercent (missing rarity data)", () => {
    mockHook({
      data: makeData([
        makeAchievement({
          displayName: "Untracked",
          unlockedAt: "2026-01-01T00:00:00Z",
          globalPercent: null,
        }),
      ]),
      isPending: false,
      isError: false,
    });
    const { container } = renderCard(<RarestUnlockCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("picks the unlocked row with the LOWEST globalPercent as the rarest", () => {
    mockHook({
      data: makeData([
        makeAchievement({
          apiName: "A1",
          displayName: "Common Win",
          unlockedAt: "2026-01-01T00:00:00Z",
          globalPercent: 40,
        }),
        makeAchievement({
          apiName: "A2",
          displayName: "Sub-1% Hunt",
          description: "Reached the impossible.",
          unlockedAt: "2026-02-01T00:00:00Z",
          globalPercent: 0.7,
        }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<RarestUnlockCard appid={440} />);
    expect(screen.getByText("Sub-1% Hunt")).toBeTruthy();
    expect(screen.getByText("Very rare")).toBeTruthy();
    expect(screen.getByText("0.7%")).toBeTruthy();
  });

  it("labels rarity as 'Rare' when 1% ≤ percent < 5%", () => {
    mockHook({
      data: makeData([
        makeAchievement({
          unlockedAt: "2026-01-01T00:00:00Z",
          globalPercent: 3,
          displayName: "Rare One",
        }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<RarestUnlockCard appid={440} />);
    expect(screen.getByText("Rare")).toBeTruthy();
  });

  it("labels rarity as 'Uncommon' for 5–24% and 'Common' for ≥25%", () => {
    mockHook({
      data: makeData([
        makeAchievement({
          unlockedAt: "2026-01-01T00:00:00Z",
          globalPercent: 10,
          displayName: "Uncommon One",
        }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<RarestUnlockCard appid={440} />);
    expect(screen.getByText("Uncommon")).toBeTruthy();
  });

  it("skips rows with null globalPercent when picking the rarest", () => {
    // The 'Hidden Rarity' row has null globalPercent — should be skipped so the
    // 30% common row wins as the only candidate.
    mockHook({
      data: makeData([
        makeAchievement({
          apiName: "A1",
          displayName: "Hidden Rarity",
          unlockedAt: "2026-01-01T00:00:00Z",
          globalPercent: null,
        }),
        makeAchievement({
          apiName: "A2",
          displayName: "Tracked Common",
          unlockedAt: "2026-02-01T00:00:00Z",
          globalPercent: 30,
        }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<RarestUnlockCard appid={440} />);
    expect(screen.getByText("Tracked Common")).toBeTruthy();
    expect(screen.getByText("Common")).toBeTruthy();
  });
});
