import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamAchievement, SteamGameAchievements } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RaritySignatureCard } from "./rarity-signature-card";
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

function unlockedAt(pct: number, i: number): SteamAchievement {
  return makeAchievement({
    apiName: `A${i}`,
    unlockedAt: "2026-01-01T00:00:00Z",
    globalPercent: pct,
  });
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

describe("RaritySignatureCard", () => {
  it("renders nothing when the schema is null or empty", () => {
    mockHook({ data: makeData(null), isPending: false, isError: false });
    const { container } = renderCard(<RaritySignatureCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no unlocked row has rarity data", () => {
    mockHook({
      data: makeData([
        makeAchievement({ unlockedAt: "2026-01-01T00:00:00Z", globalPercent: null }),
      ]),
      isPending: false,
      isError: false,
    });
    const { container } = renderCard(<RaritySignatureCard appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the small-sample verdict when fewer than 3 unlocks", () => {
    mockHook({
      data: makeData([unlockedAt(2, 1), unlockedAt(3, 2)]),
      isPending: false,
      isError: false,
    });
    renderCard(<RaritySignatureCard appid={440} />);
    expect(screen.getByText("Too few unlocks to read a signature yet.")).toBeTruthy();
  });

  it("emits the Hunter verdict when mean rarity is sub-10%", () => {
    mockHook({
      data: makeData([unlockedAt(2, 1), unlockedAt(4, 2), unlockedAt(6, 3)]),
      isPending: false,
      isError: false,
    });
    renderCard(<RaritySignatureCard appid={440} />);
    expect(screen.getByText("Hunter signature — sub-10% average rarity.")).toBeTruthy();
  });

  it("emits the 'rare ones' band for 10%–24% mean", () => {
    mockHook({
      data: makeData([unlockedAt(15, 1), unlockedAt(20, 2), unlockedAt(22, 3)]),
      isPending: false,
      isError: false,
    });
    renderCard(<RaritySignatureCard appid={440} />);
    expect(screen.getByText("Goes for the rare ones.")).toBeTruthy();
  });

  it("emits the 'mix' band for 25%–49%", () => {
    mockHook({
      data: makeData([unlockedAt(30, 1), unlockedAt(40, 2), unlockedAt(45, 3)]),
      isPending: false,
      isError: false,
    });
    renderCard(<RaritySignatureCard appid={440} />);
    expect(screen.getByText("Mix of standards and rarities.")).toBeTruthy();
  });

  it("emits the 'standard track' band for 50%–74%", () => {
    mockHook({
      data: makeData([unlockedAt(55, 1), unlockedAt(60, 2), unlockedAt(70, 3)]),
      isPending: false,
      isError: false,
    });
    renderCard(<RaritySignatureCard appid={440} />);
    expect(screen.getByText("Mostly the standard track.")).toBeTruthy();
  });

  it("emits the 'surface-level' band for ≥75%", () => {
    mockHook({
      data: makeData([unlockedAt(80, 1), unlockedAt(85, 2), unlockedAt(90, 3)]),
      isPending: false,
      isError: false,
    });
    renderCard(<RaritySignatureCard appid={440} />);
    expect(screen.getByText("Surface-level unlocks so far.")).toBeTruthy();
  });
});
