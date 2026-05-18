import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SteamAchievement, SteamGameAchievements } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AchievementPanel } from "./achievement-panel";
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

function renderWithProviders(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
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

afterEach(() => {
  vi.mocked(useGameAchievements).mockReset();
});

describe("AchievementPanel", () => {
  it("renders nothing when the game has no schema (achievements === null)", () => {
    mockHook({ data: makeData(null), isPending: false, isError: false });
    const { container } = renderWithProviders(<AchievementPanel appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the in-flight schema state when achievements array is empty", () => {
    mockHook({ data: makeData([]), isPending: false, isError: false });
    renderWithProviders(<AchievementPanel appid={440} />);
    expect(screen.queryByText(/Schema is in flight/)).not.toBeNull();
  });

  it("renders unlocked/total ratio and rows for both unlocked and locked achievements", () => {
    const rows = [
      makeAchievement({
        apiName: "A1",
        displayName: "First Blood",
        unlockedAt: "2026-01-01T00:00:00Z",
      }),
      makeAchievement({ apiName: "A2", displayName: "Locked Goal" }),
    ];
    mockHook({ data: makeData(rows), isPending: false, isError: false });
    renderWithProviders(<AchievementPanel appid={440} />);

    expect(screen.queryByText("First Blood")).not.toBeNull();
    expect(screen.queryByText("Locked Goal")).not.toBeNull();
    expect(
      screen.queryByText(
        (_: string, el: Element | null) => el?.textContent === "1 / 2 unlocked"
      )
    ).not.toBeNull();
  });

  it("truncates to PREVIEW_COUNT (12) and reveals the rest when 'Show more' is clicked", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      makeAchievement({ apiName: `A${i}`, displayName: `Goal ${i}` })
    );
    mockHook({ data: makeData(rows), isPending: false, isError: false });
    renderWithProviders(<AchievementPanel appid={440} />);

    // Show more button quotes the remaining count past PREVIEW_COUNT (12).
    const showMore = screen.getByRole("button", { name: /Show 3 more/ });
    expect(screen.queryByText("Goal 12")).toBeNull();

    fireEvent.click(showMore);
    expect(screen.queryByText("Goal 12")).not.toBeNull();
    expect(screen.queryByText("Goal 14")).not.toBeNull();
  });

  it("filters to locked rows when 'Locked only' toggle is engaged and masks hidden ones with ???", () => {
    const rows = [
      makeAchievement({
        apiName: "U1",
        displayName: "Unlocked One",
        unlockedAt: "2026-01-01T00:00:00Z",
      }),
      makeAchievement({ apiName: "L1", displayName: "Locked Visible" }),
      makeAchievement({
        apiName: "L2",
        displayName: "Hidden Locked Name",
        hidden: true,
      }),
    ];
    mockHook({ data: makeData(rows), isPending: false, isError: false });
    renderWithProviders(<AchievementPanel appid={440} />);

    // Hidden+locked row is masked from the start — its real displayName is not
    // rendered as the visible label.
    expect(screen.queryByText("Hidden Locked Name")).toBeNull();
    expect(screen.queryAllByText("???").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Locked only/ }));
    // After flipping, the unlocked row disappears from view.
    expect(screen.queryByText("Unlocked One")).toBeNull();
    expect(screen.queryByText("Locked Visible")).not.toBeNull();
  });

  it("renders the search input only when total >= SEARCH_THRESHOLD and filters by displayName", () => {
    const rows = Array.from({ length: 35 }, (_, i) =>
      makeAchievement({
        apiName: `A${i}`,
        displayName: i === 7 ? "Needle Goal" : `Generic ${i}`,
        description: i === 7 ? "Specific description." : "Hay.",
      })
    );
    mockHook({ data: makeData(rows), isPending: false, isError: false });
    renderWithProviders(<AchievementPanel appid={440} />);

    const search = screen.getByPlaceholderText(/Search 35 achievements/);
    fireEvent.change(search, { target: { value: "needle" } });

    expect(screen.queryByText("Needle Goal")).not.toBeNull();
    expect(screen.queryByText("Generic 0")).toBeNull();
  });
});
