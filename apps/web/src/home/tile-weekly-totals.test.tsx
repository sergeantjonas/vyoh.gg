import { render, screen } from "@testing-library/react";
import type { HomeWeeklyTotals } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileWeeklyTotals } from "./tile-weekly-totals";
import { useHomeWeeklyTotals } from "./use-home-weekly-totals";

vi.mock("./use-home-weekly-totals", () => ({ useHomeWeeklyTotals: vi.fn() }));

function mockHook(value: { data: HomeWeeklyTotals | undefined; isPending: boolean }) {
  vi.mocked(useHomeWeeklyTotals).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeWeeklyTotals>
  );
}

afterEach(() => {
  vi.mocked(useHomeWeeklyTotals).mockReset();
});

const totals: HomeWeeklyTotals = {
  lolMatchCount: 5,
  lolMinutes: 150,
  steamMinutes: 60,
  totalMinutes: 210,
  weekStart: "2026-05-12T00:00:00.000Z",
  weekEnd: "2026-05-19T00:00:00.000Z",
  timeZone: "Europe/Brussels",
};

describe("TileWeeklyTotals", () => {
  it("renders the pending placeholder while the query is loading", () => {
    mockHook({ data: undefined, isPending: true });
    render(<TileWeeklyTotals />);
    expect(screen.getByText("Loading weekly totals…")).toBeTruthy();
  });

  it("renders the empty placeholder when the query resolves with no data", () => {
    mockHook({ data: undefined, isPending: false });
    render(<TileWeeklyTotals />);
    expect(screen.getByText("No weekly totals available.")).toBeTruthy();
  });

  it("renders the quiet-week placeholder when there are 0 totals and 0 matches", () => {
    mockHook({
      data: {
        ...totals,
        totalMinutes: 0,
        lolMatchCount: 0,
        lolMinutes: 0,
        steamMinutes: 0,
      },
      isPending: false,
    });
    render(<TileWeeklyTotals />);
    expect(screen.getByText("A quiet seven days.")).toBeTruthy();
  });

  it("renders totals + matches/playtime + week-end label when data is present", () => {
    mockHook({ data: totals, isPending: false });
    render(<TileWeeklyTotals />);
    expect(screen.getByText("3h 30m gaming")).toBeTruthy();
    expect(screen.getByText(/5 matches/)).toBeTruthy();
    expect(screen.getByText(/Last 7 days · ending/)).toBeTruthy();
  });

  it("renders Steam as em-dash when steamMinutes is 0 but other streams have play", () => {
    mockHook({
      data: { ...totals, steamMinutes: 0, totalMinutes: 150 },
      isPending: false,
    });
    render(<TileWeeklyTotals />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("uses singular 'match' when exactly one LoL match is in the window", () => {
    mockHook({
      data: { ...totals, lolMatchCount: 1, lolMinutes: 30, totalMinutes: 90 },
      isPending: false,
    });
    render(<TileWeeklyTotals />);
    expect(screen.getByText(/1 match /)).toBeTruthy();
  });
});
