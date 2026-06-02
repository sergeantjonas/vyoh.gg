import { useHomeToday } from "@/home/use-home-today";
import { render, screen } from "@testing-library/react";
import type { HomeToday } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayStrip } from "./today-strip";

vi.mock("@/home/use-home-today", () => ({ useHomeToday: vi.fn() }));

function mockHook(value: { data: HomeToday | undefined; isPending: boolean }) {
  vi.mocked(useHomeToday).mockReturnValue(
    value as unknown as ReturnType<typeof useHomeToday>
  );
}

afterEach(() => {
  vi.mocked(useHomeToday).mockReset();
});

describe("TodayStrip", () => {
  it("renders chip placeholders while the today query is pending", () => {
    mockHook({ data: undefined, isPending: true });
    render(<TodayStrip />);
    expect(screen.getByText("Matches")).toBeTruthy();
    expect(screen.getByText("K / D / A")).toBeTruthy();
    expect(screen.getByText("Steam")).toBeTruthy();
    expect(screen.getByText("Unlocks")).toBeTruthy();
    expect(screen.getByText("Last 24 hours")).toBeTruthy();
  });

  it("renders match count + W-L breakdown when there are matches today", () => {
    mockHook({
      data: {
        lolMatches: 3,
        lolWins: 2,
        lolLosses: 1,
        kills: 16,
        deaths: 12,
        assists: 25,
        steamMinutes: 135,
        achievementUnlocks: 4,
        asOf: "2026-06-02T18:00:00.000Z",
        timeZone: "Europe/Brussels",
      },
      isPending: false,
    });
    render(<TodayStrip />);
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2W 1L")).toBeTruthy();
    expect(screen.getByText("16 / 12 / 25")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    // 135 min → 2h 15m via formatHoursMinutes.
    expect(screen.getByText("2h 15m")).toBeTruthy();
  });

  it("shows dashes for chips with zero values so empty days don't read as real numbers", () => {
    mockHook({
      data: {
        lolMatches: 0,
        lolWins: 0,
        lolLosses: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        steamMinutes: 0,
        achievementUnlocks: 0,
        asOf: "2026-06-02T03:00:00.000Z",
        timeZone: "Europe/Brussels",
      },
      isPending: false,
    });
    render(<TodayStrip />);
    // Four chips, each with a dash; the chip values are the only "—"
    // strings rendered by the component.
    expect(screen.getAllByText("—")).toHaveLength(4);
  });
});
