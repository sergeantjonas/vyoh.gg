import { useHomeLifetimeTotals } from "@/home/use-home-lifetime-totals";
import { render, screen } from "@testing-library/react";
import type { HomeLifetimeTotals } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifetimeTotalsStrip } from "./lifetime-totals-strip";

vi.mock("@/home/use-home-lifetime-totals", () => ({ useHomeLifetimeTotals: vi.fn() }));

function mockHook(value: { data: HomeLifetimeTotals | undefined; isPending: boolean }) {
  vi.mocked(useHomeLifetimeTotals).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeLifetimeTotals>
  );
}

afterEach(() => {
  vi.mocked(useHomeLifetimeTotals).mockReset();
});

describe("LifetimeTotalsStrip", () => {
  it("renders chip placeholders while the lifetime query is pending", () => {
    mockHook({ data: undefined, isPending: true });
    render(<LifetimeTotalsStrip />);
    expect(screen.getByText("LoL matches")).toBeTruthy();
    expect(screen.getByText("Steam time")).toBeTruthy();
    expect(screen.getByText("Tracking since")).toBeTruthy();
    expect(screen.getByText("Since launch")).toBeTruthy();
  });

  it("renders alltime chips with compact integer + compact hours formatting", () => {
    mockHook({
      data: {
        lolMatchCount: 12_300,
        lolMinutes: 42_000, // 700h
        steamMinutes: 12_300, // 205h
        oldestMatchAt: "2024-03-15T18:00:00.000Z",
        oldestUnlockAt: "2024-04-01T12:00:00.000Z",
      },
      isPending: false,
    });
    render(<LifetimeTotalsStrip />);
    expect(screen.getByText("12.3k")).toBeTruthy();
    expect(screen.getByText("700h")).toBeTruthy();
    expect(screen.getByText("205h")).toBeTruthy();
    // Earliest of match (Mar 2024) vs unlock (Apr 2024).
    expect(screen.getByText("Mar 2024")).toBeTruthy();
  });

  it("uses earliest of match-or-unlock for the tracking-since date", () => {
    mockHook({
      data: {
        lolMatchCount: 5,
        lolMinutes: 100,
        steamMinutes: 0,
        oldestMatchAt: "2025-08-01T00:00:00.000Z",
        oldestUnlockAt: "2024-12-15T00:00:00.000Z",
      },
      isPending: false,
    });
    render(<LifetimeTotalsStrip />);
    expect(screen.getByText("Dec 2024")).toBeTruthy();
  });

  it("shows a dash for Steam time when zero and for tracking-since when both dates are null", () => {
    mockHook({
      data: {
        lolMatchCount: 5,
        lolMinutes: 120,
        steamMinutes: 0,
        oldestMatchAt: null,
        oldestUnlockAt: null,
      },
      isPending: false,
    });
    render(<LifetimeTotalsStrip />);
    expect(screen.getByText("Steam time")).toBeTruthy();
    expect(screen.getByText("2h")).toBeTruthy();
    // Two dashes: one for Steam time, one for Tracking since.
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
