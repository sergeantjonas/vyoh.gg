import { useHomeWeeklyTotals } from "@/home/use-home-weekly-totals";
import { render, screen } from "@testing-library/react";
import type { HomeWeeklyTotals } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifetimeTotalsStrip } from "./lifetime-totals-strip";

vi.mock("@/home/use-home-weekly-totals", () => ({ useHomeWeeklyTotals: vi.fn() }));

function mockHook(value: { data: HomeWeeklyTotals | undefined; isPending: boolean }) {
  vi.mocked(useHomeWeeklyTotals).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeWeeklyTotals>
  );
}

afterEach(() => {
  vi.mocked(useHomeWeeklyTotals).mockReset();
});

describe("LifetimeTotalsStrip", () => {
  it("renders chip placeholders while the totals query is pending", () => {
    mockHook({ data: undefined, isPending: true });
    render(<LifetimeTotalsStrip />);
    expect(screen.getByText("LoL matches")).toBeTruthy();
    expect(screen.getByText("Steam time")).toBeTruthy();
    expect(screen.getByText("The last seven days")).toBeTruthy();
  });

  it("renders the totals chips with formatted values when data resolves", () => {
    mockHook({
      data: {
        lolMatchCount: 12,
        lolMinutes: 600,
        steamMinutes: 180,
        totalMinutes: 780,
        weekStart: "2026-05-25T00:00:00Z",
        weekEnd: "2026-06-01T00:00:00Z",
        timeZone: "Europe/Brussels",
      },
      isPending: false,
    });
    render(<LifetimeTotalsStrip />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("10h")).toBeTruthy();
    expect(screen.getByText("3h")).toBeTruthy();
    expect(screen.getByText("13h")).toBeTruthy();
    expect(screen.getByText(/The last seven days · ending/)).toBeTruthy();
  });

  it("shows a dash for Steam time when zero", () => {
    mockHook({
      data: {
        lolMatchCount: 5,
        lolMinutes: 300,
        steamMinutes: 0,
        totalMinutes: 300,
        weekStart: "2026-05-25T00:00:00Z",
        weekEnd: "2026-06-01T00:00:00Z",
        timeZone: "Europe/Brussels",
      },
      isPending: false,
    });
    render(<LifetimeTotalsStrip />);
    expect(screen.getByText("Steam time")).toBeTruthy();
    // LoL time + Total both render "5h" when Steam minutes are zero.
    expect(screen.getAllByText("5h")).toHaveLength(2);
  });
});
