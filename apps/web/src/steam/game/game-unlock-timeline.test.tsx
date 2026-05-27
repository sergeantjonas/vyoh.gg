import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { GameUnlockTimeline as Timeline } from "@vyoh/shared";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameUnlockTimeline } from "./game-unlock-timeline";
import { useGameUnlockTimeline } from "./use-game-unlock-timeline";

function renderWithTooltipProvider(ui: ReactElement) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

vi.mock("./use-game-unlock-timeline", () => ({
  useGameUnlockTimeline: vi.fn(),
}));

type HookReturn = { data: Timeline | undefined; isPending: boolean };

function mockHook(value: HookReturn): void {
  vi.mocked(useGameUnlockTimeline).mockReturnValue(
    value as unknown as ReturnType<typeof useGameUnlockTimeline>
  );
}

afterEach(() => {
  vi.mocked(useGameUnlockTimeline).mockReset();
});

describe("GameUnlockTimeline", () => {
  it("renders nothing while the query is pending", () => {
    mockHook({ data: undefined, isPending: true });
    const { container } = renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no unlocks exist", () => {
    mockHook({
      data: { unlocks: [], total: 0, achievementCount: null },
      isPending: false,
    });
    const { container } = renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a single dot for a one-unlock series", () => {
    mockHook({
      data: {
        unlocks: ["2026-05-15T18:00:00Z"],
        total: 1,
        achievementCount: null,
      },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    const dots = screen.getAllByRole("button");
    expect(dots).toHaveLength(1);
    expect(dots[0]?.getAttribute("aria-label")).toMatch(/\+1 unlock/);
    expect(
      screen.queryByText(
        (_: string, el: Element | null) => el?.textContent === "1 unlock across 1 session"
      )
    ).not.toBeNull();
  });

  it("renders one dot per detected session and aria-labels each with count + date", () => {
    // Session 1: three unlocks within ~3h on 2020-11-07.
    // Session 2: one unlock 90 days later.
    const unlocks = [
      "2020-11-07T18:00:00Z",
      "2020-11-07T19:30:00Z",
      "2020-11-07T20:45:00Z",
      "2021-02-05T18:00:00Z",
    ];
    mockHook({
      data: { unlocks, total: 4, achievementCount: null },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    const dots = screen.getAllByRole("button");
    expect(dots).toHaveLength(2);
    const labels = dots.map((d) => d.getAttribute("aria-label") ?? "");
    expect(labels.some((l) => l.includes("+3 unlocks"))).toBe(true);
    expect(labels.some((l) => l.includes("+1 unlock"))).toBe(true);
    // Cumulative tail should appear: first session contributes 3, second adds 1 → 4 of 4.
    expect(labels.some((l) => l.includes("(3 of 4)"))).toBe(true);
    expect(labels.some((l) => l.includes("(4 of 4)"))).toBe(true);

    expect(
      screen.queryByText(
        (_: string, el: Element | null) =>
          el?.textContent === "4 unlocks across 2 sessions"
      )
    ).not.toBeNull();
  });

  it("treats a >4h gap as a session boundary", () => {
    const unlocks = ["2026-05-01T10:00:00Z", "2026-05-01T15:00:01Z"];
    mockHook({
      data: { unlocks, total: 2, achievementCount: null },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    const dots = screen.getAllByRole("button");
    expect(dots).toHaveLength(2);
    expect(
      screen.queryByText(
        (_: string, el: Element | null) =>
          el?.textContent === "2 unlocks across 2 sessions"
      )
    ).not.toBeNull();
  });

  it("renders bookend dates for multi-session spans", () => {
    const unlocks = [
      "2025-08-03T18:00:00Z",
      "2025-12-02T18:00:00Z",
      "2026-02-16T18:00:00Z",
    ];
    mockHook({
      data: { unlocks, total: 3, achievementCount: null },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    expect(screen.queryByText(/Aug 3, 2025/)).not.toBeNull();
    expect(screen.queryByText(/Feb 16, 2026/)).not.toBeNull();
  });

  it("omits the trailing bookend for a single-session series", () => {
    mockHook({
      data: {
        unlocks: ["2026-05-15T18:00:00Z"],
        total: 1,
        achievementCount: null,
      },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    // Only the first bookend should appear — no "→" right-hand label.
    expect(screen.getAllByText(/May 15, 2026/)).toHaveLength(1);
  });

  it("renders the 100% pill and an 'N of N' summary when fully completed", () => {
    mockHook({
      data: {
        unlocks: ["2026-05-01T10:00:00Z", "2026-05-02T10:00:00Z"],
        total: 2,
        achievementCount: 2,
      },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    // Header pill: amber background distinguishes it from the chart's goal-line label.
    const pill = screen
      .getAllByText("100%")
      .find((el) => el.className.includes("bg-amber-500/15"));
    expect(pill).not.toBeUndefined();
    expect(
      screen.queryByText(
        (_: string, el: Element | null) =>
          el?.textContent === "2 of 2 unlocks across 2 sessions"
      )
    ).not.toBeNull();
  });

  it("does not render the 100% pill when unlocks are below the schema total", () => {
    mockHook({
      data: {
        unlocks: ["2026-05-01T10:00:00Z"],
        total: 1,
        achievementCount: 10,
      },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    // The amber-tinted header pill should not be present; the muted chart-rail
    // label may still render because achievementCount is known.
    const pill = screen
      .queryAllByText("100%")
      .find((el) => el.className.includes("bg-amber-500/15"));
    expect(pill).toBeUndefined();
    expect(
      screen.queryByText(
        (_: string, el: Element | null) =>
          el?.textContent === "1 of 10 unlocks across 1 session"
      )
    ).not.toBeNull();
  });

  it("renders a chart goal-line label whenever achievementCount is known", () => {
    mockHook({
      data: {
        unlocks: ["2026-05-01T10:00:00Z"],
        total: 1,
        achievementCount: 10,
      },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    const railLabel = screen
      .getAllByText("100%")
      .find((el) => el.className.includes("absolute"));
    expect(railLabel).not.toBeUndefined();
  });

  it("omits the chart goal-line label when achievementCount is null", () => {
    mockHook({
      data: {
        unlocks: ["2026-05-01T10:00:00Z"],
        total: 1,
        achievementCount: null,
      },
      isPending: false,
    });
    renderWithTooltipProvider(<GameUnlockTimeline appid={440} />);

    expect(screen.queryByText("100%")).toBeNull();
  });
});
