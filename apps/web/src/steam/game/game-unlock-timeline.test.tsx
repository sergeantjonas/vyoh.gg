import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { GameUnlockTimeline as Timeline } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUnlockTimeline } from "./game-unlock-timeline";
import { useGameUnlockTimeline } from "./use-game-unlock-timeline";

vi.mock("./use-game-unlock-timeline", () => ({
  useGameUnlockTimeline: vi.fn(),
}));

type HookReturn = { data: Timeline | undefined; isPending: boolean };

function mockHook(value: HookReturn): void {
  vi.mocked(useGameUnlockTimeline).mockReturnValue(
    value as unknown as ReturnType<typeof useGameUnlockTimeline>
  );
}

function renderWithProviders(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

afterEach(() => {
  vi.mocked(useGameUnlockTimeline).mockReset();
});

describe("GameUnlockTimeline", () => {
  it("renders nothing while the query is pending", () => {
    mockHook({ data: undefined, isPending: true });
    const { container } = renderWithProviders(<GameUnlockTimeline appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no months have any unlocks", () => {
    mockHook({ data: { months: [], total: 0 }, isPending: false });
    const { container } = renderWithProviders(<GameUnlockTimeline appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders first/last month labels and singular 'unlock' / 'month' on a 1-of-1 series", () => {
    mockHook({
      data: { months: [{ year: 2026, month: 5, count: 1 }], total: 1 },
      isPending: false,
    });
    renderWithProviders(<GameUnlockTimeline appid={440} />);

    // displayLast === single month → both edge labels read "May 2026".
    expect(screen.queryAllByText("May 2026").length).toBeGreaterThan(0);
    // Singular pluralisation on the footer.
    expect(
      screen.queryByText(
        (_: string, el: Element | null) => el?.textContent === "1 unlock across 1 month"
      )
    ).not.toBeNull();
  });

  it("pads short series up to MIN_BARS (12) so a 3-month dataset still renders a 12-bar grid", () => {
    const months = [
      { year: 2026, month: 3, count: 1 },
      { year: 2026, month: 4, count: 2 },
      { year: 2026, month: 5, count: 5 },
    ];
    mockHook({ data: { months, total: 8 }, isPending: false });
    const { container } = renderWithProviders(<GameUnlockTimeline appid={440} />);

    // Each MonthBar wraps its bar in a flex-1 div as the Tooltip trigger; the
    // total count of these triggers equals the displayMonths length.
    const bars = container.querySelectorAll("[data-state='closed']");
    expect(bars.length).toBe(12);
    // First-edge label reflects the padded leading month (May 2026 minus 11
    // backwards = Jun 2025).
    expect(screen.queryByText("Jun 2025")).not.toBeNull();
    expect(screen.queryByText("May 2026")).not.toBeNull();
    // Plural footer copy.
    expect(
      screen.queryByText(
        (_: string, el: Element | null) => el?.textContent === "8 unlocks across 3 months"
      )
    ).not.toBeNull();
  });
});
