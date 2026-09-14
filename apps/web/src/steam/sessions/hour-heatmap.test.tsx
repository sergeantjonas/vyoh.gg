import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamSessions } from "@vyoh/shared";
import { emptyHourMatrix } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HourHeatmapCard } from "./hour-heatmap";
import { useSteamSessions } from "./use-sessions";

vi.mock("./use-sessions", () => ({ useSteamSessions: vi.fn(), SESSIONS_WEEKS: 12 }));

const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

function page(matrix: number[][], sessionCount = 12): SteamSessions {
  return {
    window: { from: "", to: "", observedSince: "2026-05-16T00:00:00.000Z", sessionCount },
    live: null,
    sessions: [],
    hourMatrix: matrix,
    timeZone: "Europe/Brussels",
    perGame: [],
    milestones: [],
    records: {
      longest: null,
      latestFinish: null,
      mostUnlocks: null,
      longestDrySpell: null,
      quickestBounce: null,
    },
    offCamera: [],
  };
}

function mock(data: SteamSessions) {
  vi.mocked(useSteamSessions).mockReturnValue({
    data,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSteamSessions>);
}

function wrap(ui: ReactNode) {
  return (
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("HourHeatmapCard", () => {
  it("names the fullest cell as the usual slot and lists every played cell for screen readers", async () => {
    const matrix = emptyHourMatrix();
    const tue = matrix[1];
    const sat = matrix[5];
    if (!tue || !sat) throw new Error("fixture");
    tue[20] = 200;
    tue[21] = 180;
    sat[14] = 60;
    mock(page(matrix));
    const { container } = render(wrap(<HourHeatmapCard />));
    expect(
      screen.getByText(
        "Usual slot: Tuesday around 20:00 — 3h 20m of 7h 20m in the window."
      )
    ).toBeTruthy();
    expect(screen.getByRole("row", { name: /Tuesday 20:00/ })).toBeTruthy();
    expect(screen.getByRole("row", { name: /Saturday 14:00/ })).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("declines to read a rhythm into a handful of minutes", () => {
    const matrix = emptyHourMatrix();
    const row = matrix[0];
    if (!row) throw new Error("fixture");
    row[10] = 90;
    mock(page(matrix, 1));
    render(wrap(<HourHeatmapCard />));
    expect(screen.getByText(/not enough to see a rhythm yet/)).toBeTruthy();
  });
});
