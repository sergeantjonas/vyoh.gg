import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { HomeDaySplit, HomeDaySplitHour } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileDaySplit } from "./tile-day-split";
import { useHomeDaySplit } from "./use-home-day-split";

vi.mock("./use-home-day-split", () => ({ useHomeDaySplit: vi.fn() }));

function mockHook(value: { data: HomeDaySplit | undefined; isPending: boolean }) {
  vi.mocked(useHomeDaySplit).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeDaySplit>
  );
}

function renderWithTooltip(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

function emptyHour(hour: number): HomeDaySplitHour {
  return { hour, lolMinutes: 0, steamMinutes: 0 };
}

function makeData(overrides: Partial<HomeDaySplit> = {}): HomeDaySplit {
  const hours = Array.from({ length: 24 }, (_, i) => emptyHour(i));
  hours[20] = { hour: 20, lolMinutes: 60, steamMinutes: 0 };
  hours[22] = { hour: 22, lolMinutes: 0, steamMinutes: 30 };
  return {
    hours,
    totalLolMinutes: 60,
    totalSteamMinutes: 30,
    timeZone: "Europe/Brussels",
    ...overrides,
  };
}

afterEach(() => {
  vi.mocked(useHomeDaySplit).mockReset();
});

describe("TileDaySplit", () => {
  it("renders the loading verdict while pending", () => {
    mockHook({ data: undefined, isPending: true });
    renderWithTooltip(<TileDaySplit />);
    expect(screen.getByText("Loading evening split…")).toBeTruthy();
  });

  it("renders the no-data verdict when the query resolves with no data", () => {
    mockHook({ data: undefined, isPending: false });
    renderWithTooltip(<TileDaySplit />);
    expect(screen.getByText("No evening split available.")).toBeTruthy();
  });

  it("renders the not-enough verdict when totals are zero", () => {
    mockHook({
      data: makeData({
        hours: Array.from({ length: 24 }, (_, i) => emptyHour(i)),
        totalLolMinutes: 0,
        totalSteamMinutes: 0,
      }),
      isPending: false,
    });
    renderWithTooltip(<TileDaySplit />);
    expect(screen.getByText("Not enough closed sessions yet.")).toBeTruthy();
  });

  it("renders the share headline and tz-labelled footer when data is present", () => {
    mockHook({ data: makeData(), isPending: false });
    renderWithTooltip(<TileDaySplit />);
    // 60 / 90 ≈ 67% LoL, 33% Steam
    expect(screen.getByText("67% LoL, 33% Steam across the day.")).toBeTruthy();
    expect(
      screen.getByText(
        (_, el) => el?.textContent === "Hours in Brussels · 1h LoL + 30m Steam"
      )
    ).toBeTruthy();
  });
});
