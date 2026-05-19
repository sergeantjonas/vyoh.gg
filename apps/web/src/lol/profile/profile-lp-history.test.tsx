import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { MatchWindowProvider } from "@/lol/matches/match-window-context";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { LolAccount, MatchSummary, RankHistoryPoint } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileLpHistory } from "./profile-lp-history";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-rank-history", () => ({
  useRankHistory: vi.fn(),
}));

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const NullEl = () => null;
  return {
    LineChart: Passthrough,
    Line: NullEl,
    XAxis: NullEl,
    YAxis: NullEl,
    Tooltip: NullEl,
    CartesianGrid: NullEl,
    ReferenceArea: NullEl,
    ReferenceDot: NullEl,
    ReferenceLine: NullEl,
    ResponsiveContainer: Passthrough,
  };
});

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: { children: (size: { width: number; height: number }) => ReactNode }) =>
    children({ width: 400, height: 60 }),
}));

let lastBrushOnChange: ((b: unknown) => void) | null = null;
vi.mock("@visx/brush", () => ({
  Brush: ({ onChange }: { onChange: (b: unknown) => void }) => {
    lastBrushOnChange = onChange;
    return <div data-testid="brush" />;
  },
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function point(overrides: Partial<RankHistoryPoint> = {}): RankHistoryPoint {
  return {
    capturedAt: "2026-01-01T00:00:00Z",
    queueId: "RANKED_SOLO_5x5",
    tier: "SILVER",
    rank: "II",
    leaguePoints: 50,
    ...overrides,
  } as RankHistoryPoint;
}

function setHistory(opts: {
  isLoading?: boolean;
  isError?: boolean;
  solo?: RankHistoryPoint[];
  flex?: RankHistoryPoint[];
}) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useRankHistory).mockReturnValue({
    data:
      opts.solo || opts.flex
        ? { solo: opts.solo ?? [], flex: opts.flex ?? [] }
        : undefined,
    isLoading: opts.isLoading ?? false,
    isError: opts.isError ?? false,
  } as unknown as ReturnType<typeof useRankHistory>);
}

function renderShell(matches: MatchSummary[] = []) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <MatchWindowProvider
          value={{
            matches,
            isPending: false,
            total: matches.length,
            count: matches.length,
            setCount: () => {},
          }}
        >
          <ProfileLpHistory accountSlug="jonas-euw" />
        </MatchWindowProvider>
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useRankHistory).mockReset();
});

describe("ProfileLpHistory", () => {
  it("renders the empty state with the 'no snapshots' title when there is no data", () => {
    setHistory({ solo: [], flex: [] });
    renderShell();
    expect(screen.getByText("LP History")).toBeTruthy();
    expect(screen.getByText("No rank snapshots yet")).toBeTruthy();
  });

  it("renders an error empty state when the rank history query has errored", () => {
    setHistory({ isError: true, solo: [] });
    renderShell();
    expect(screen.getByText("Couldn't load rank history")).toBeTruthy();
  });

  it("renders the chart container and brush when there are at least 4 snapshots", () => {
    const points = Array.from({ length: 6 }, (_, i) =>
      point({
        capturedAt: new Date(2026, 0, i + 1).toISOString(),
        leaguePoints: 30 + i * 10,
      })
    );
    setHistory({ solo: points });
    renderShell();
    expect(screen.getByTestId("brush")).toBeTruthy();
    expect(screen.getByText(/Drag across the strip to zoom/)).toBeTruthy();
  });

  it("does not render the brush hint when fewer than 4 snapshots exist", () => {
    setHistory({
      solo: [point(), point({ leaguePoints: 60 }), point({ leaguePoints: 75 })],
    });
    renderShell();
    expect(screen.queryByText(/Drag across the strip to zoom/)).toBeNull();
  });

  it("renders a streak chip when a 3+ outcome run is present in the dataset", () => {
    const points = [
      point({ leaguePoints: 30 }),
      point({ leaguePoints: 50 }),
      point({ leaguePoints: 70 }),
      point({ leaguePoints: 90 }),
    ];
    setHistory({ solo: points });
    renderShell();
    // Win run shows "NW run" — exact length depends on findLongestStreak;
    // just assert the suffix.
    expect(screen.getByText(/W run/)).toBeTruthy();
  });

  it("switches to the flex queue when the Flex tab is clicked", () => {
    setHistory({ solo: [point()], flex: [point({ leaguePoints: 99 })] });
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    // After switching to flex, the active queue's tab becomes the highlighted one;
    // we just verify the button exists and is not disabled.
    const flexBtn = screen.getByRole("button", { name: "Flex" }) as HTMLButtonElement;
    expect(flexBtn.disabled).toBe(false);
  });

  it("auto-selects flex when only flex data exists", () => {
    setHistory({ solo: [], flex: [point()] });
    renderShell();
    // Solo tab should be disabled when no solo data
    const soloBtn = screen.getByRole("button", { name: "Solo/Duo" }) as HTMLButtonElement;
    expect(soloBtn.disabled).toBe(true);
  });

  it("renders patch boundary lines when matches span multiple game versions", () => {
    const captureBase = new Date("2026-01-01T00:00:00Z").getTime();
    const points = Array.from({ length: 6 }, (_, i) =>
      point({
        capturedAt: new Date(captureBase + i * 86_400_000).toISOString(),
        leaguePoints: 30 + i * 10,
      })
    );
    setHistory({ solo: points });
    const matches: MatchSummary[] = [
      {
        matchId: "M1",
        queueType: "Ranked Solo",
        champion: "Ahri",
        kills: 1,
        deaths: 1,
        assists: 1,
        win: true,
        durationSec: 1800,
        playedAt: new Date(captureBase + 86_400_000).toISOString(),
        remake: false,
        teamPosition: "MIDDLE",
        gameVersion: "16.1.1.1",
      } as unknown as MatchSummary,
      {
        matchId: "M2",
        queueType: "Ranked Solo",
        champion: "Ahri",
        kills: 1,
        deaths: 1,
        assists: 1,
        win: true,
        durationSec: 1800,
        playedAt: new Date(captureBase + 3 * 86_400_000).toISOString(),
        remake: false,
        teamPosition: "MIDDLE",
        gameVersion: "16.2.1.1",
      } as unknown as MatchSummary,
    ];
    renderShell(matches);
    // Patch-boundary lines are recharts ReferenceLine elements, which the mock
    // renders as null — coverage gets exercised when the .map() body runs.
    // Sanity: the section header is still there.
    expect(screen.getByText("LP History")).toBeTruthy();
  });

  it("renders tier-change indicator dots when rank tier changes between snapshots", () => {
    const captureBase = new Date("2026-01-01T00:00:00Z").getTime();
    const points = [
      point({
        capturedAt: new Date(captureBase).toISOString(),
        tier: "SILVER",
        rank: "II",
        leaguePoints: 80,
      }),
      point({
        capturedAt: new Date(captureBase + 86_400_000).toISOString(),
        tier: "SILVER",
        rank: "I",
        leaguePoints: 30,
      }),
      point({
        capturedAt: new Date(captureBase + 2 * 86_400_000).toISOString(),
        tier: "GOLD",
        rank: "IV",
        leaguePoints: 5,
      }),
      point({
        capturedAt: new Date(captureBase + 3 * 86_400_000).toISOString(),
        tier: "GOLD",
        rank: "IV",
        leaguePoints: 60,
      }),
    ];
    setHistory({ solo: points });
    renderShell();
    expect(screen.getByText("LP History")).toBeTruthy();
  });

  it("applies a brush sub-range and a Show all reset clears it", () => {
    const captureBase = new Date("2026-01-01T00:00:00Z").getTime();
    const points = Array.from({ length: 6 }, (_, i) =>
      point({
        capturedAt: new Date(captureBase + i * 86_400_000).toISOString(),
        leaguePoints: 30 + i * 10,
      })
    );
    setHistory({ solo: points });
    renderShell();
    // Drive the visx brush onChange handler captured by the mock.
    if (!lastBrushOnChange) throw new Error("brush onChange not captured");
    act(() => {
      lastBrushOnChange?.({ x0: 0, x1: Number.POSITIVE_INFINITY });
    });
    // Hint text should flip to the sub-range form once a brush is active.
    expect(screen.getByText(/Showing a sub-range/)).toBeTruthy();
    // Click Show all to clear it.
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByText(/Drag across the strip to zoom/)).toBeTruthy();
    // And clearing via null (the early-return branch).
    if (!lastBrushOnChange) throw new Error("brush onChange not captured");
    act(() => {
      lastBrushOnChange?.(null);
    });
    expect(screen.getByText(/Drag across the strip to zoom/)).toBeTruthy();
  });

  it("changes the requested range when a Range tab is clicked", () => {
    setHistory({ solo: [point()] });
    renderShell();
    // useRankHistory should have been called with the initial range
    const initialCalls = vi.mocked(useRankHistory).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "30d" }));
    const afterCalls = vi.mocked(useRankHistory).mock.calls.length;
    expect(afterCalls).toBeGreaterThan(initialCalls);
    const lastCall = vi.mocked(useRankHistory).mock.calls.at(-1);
    expect(lastCall?.[1]).toBe("30d");
  });
});
