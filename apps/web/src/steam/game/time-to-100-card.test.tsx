import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamAchievement, SteamGameAchievements } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TimeTo100Card } from "./time-to-100-card";
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

const NOW_ISO = "2026-05-19T12:00:00Z";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.mocked(useGameAchievements).mockReset();
});

describe("TimeTo100Card", () => {
  it("renders nothing when the schema is null", () => {
    mockHook({ data: makeData(null), isPending: false, isError: false });
    const { container } = renderCard(<TimeTo100Card appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no row has been unlocked", () => {
    mockHook({
      data: makeData([makeAchievement({ unlockedAt: null })]),
      isPending: false,
      isError: false,
    });
    const { container } = renderCard(<TimeTo100Card appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the 100% verdict in months when every row is unlocked over a multi-month span", () => {
    mockHook({
      data: makeData([
        makeAchievement({ apiName: "A1", unlockedAt: "2026-01-19T00:00:00Z" }),
        makeAchievement({ apiName: "A2", unlockedAt: "2026-05-19T00:00:00Z" }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<TimeTo100Card appid={440} />);
    // 120 days → "4 months"
    expect(screen.getByText("100%'d over 4 months.")).toBeTruthy();
    expect(screen.getByText("120d")).toBeTruthy();
  });

  it("renders 'a single session' for spans of 1 day or less", () => {
    mockHook({
      data: makeData([
        makeAchievement({ apiName: "A1", unlockedAt: "2026-05-19T10:00:00Z" }),
        makeAchievement({ apiName: "A2", unlockedAt: "2026-05-19T11:00:00Z" }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<TimeTo100Card appid={440} />);
    expect(screen.getByText("100%'d over a single session.")).toBeTruthy();
  });

  it("renders an in-progress verdict referencing the first unlock when not 100%", () => {
    mockHook({
      data: makeData([
        makeAchievement({
          apiName: "A1",
          unlockedAt: "2026-05-01T00:00:00Z",
        }),
        makeAchievement({ apiName: "A2", unlockedAt: null }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<TimeTo100Card appid={440} />);
    expect(screen.getByText(/First unlock .* — still pecking away\./)).toBeTruthy();
    expect(screen.getByText("0d in")).toBeTruthy();
  });

  it("renders multi-year spans with one decimal year", () => {
    mockHook({
      data: makeData([
        makeAchievement({ apiName: "A1", unlockedAt: "2024-01-01T00:00:00Z" }),
        makeAchievement({ apiName: "A2", unlockedAt: "2026-05-19T00:00:00Z" }),
      ]),
      isPending: false,
      isError: false,
    });
    renderCard(<TimeTo100Card appid={440} />);
    // ~869 days / 365 → "2.4 years"
    expect(screen.getByText(/100%'d over 2\.4 years\./)).toBeTruthy();
  });
});
