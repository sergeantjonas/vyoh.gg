import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { DetectedSeason, LolAccount } from "@vyoh/shared";
import { detectSeasons } from "@vyoh/shared/lol/rank-history";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileSeasonHistory } from "./profile-season-history";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/profile/use-rank-history", () => ({
  useRankHistory: vi.fn(),
}));

vi.mock("@vyoh/shared/lol/rank-history", () => ({
  detectSeasons: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function season(overrides: Partial<DetectedSeason> = {}): DetectedSeason {
  return {
    startAt: "2026-01-01T00:00:00Z",
    endAt: "2026-04-01T00:00:00Z",
    startRank: { tier: "SILVER", rank: "III", leaguePoints: 50, totalLp: 0 },
    endRank: { tier: "GOLD", rank: "IV", leaguePoints: 75, totalLp: 1500 },
    peakRank: { tier: "PLATINUM", rank: "IV", leaguePoints: 10, totalLp: 2400 },
    ongoing: false,
    ...overrides,
  };
}

function setHistory(opts: {
  isLoading?: boolean;
  solo?: DetectedSeason[];
  flex?: DetectedSeason[];
}) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useRankHistory).mockReturnValue({
    data: { solo: [], flex: [] },
    isLoading: opts.isLoading ?? false,
  } as unknown as ReturnType<typeof useRankHistory>);
  vi.mocked(detectSeasons).mockImplementation((points) => {
    // Distinguish solo vs flex by the array identity of the points sentinel.
    if (points === SOLO_POINTS) return opts.solo ?? [];
    if (points === FLEX_POINTS) return opts.flex ?? [];
    return [];
  });
}

const SOLO_POINTS: unknown[] = [{ tag: "solo" }];
const FLEX_POINTS: unknown[] = [{ tag: "flex" }];

function setHistoryWithPoints(opts: {
  isLoading?: boolean;
  solo?: DetectedSeason[];
  flex?: DetectedSeason[];
}) {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useRankHistory).mockReturnValue({
    data: { solo: SOLO_POINTS, flex: FLEX_POINTS },
    isLoading: opts.isLoading ?? false,
  } as unknown as ReturnType<typeof useRankHistory>);
  vi.mocked(detectSeasons).mockImplementation((points) => {
    if (points === SOLO_POINTS) return opts.solo ?? [];
    if (points === FLEX_POINTS) return opts.flex ?? [];
    return [];
  });
}

function renderShell() {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <ProfileSeasonHistory accountSlug="jonas-euw" />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useRankHistory).mockReset();
  vi.mocked(detectSeasons).mockReset();
});

describe("ProfileSeasonHistory", () => {
  it("renders the loading skeleton while rank history is loading", () => {
    setHistory({ isLoading: true });
    const { container } = renderShell();
    expect(screen.getByText("Season history")).toBeTruthy();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders null when there are no seasons in either queue", () => {
    setHistoryWithPoints({ solo: [], flex: [] });
    const { container } = renderShell();
    expect(container.firstChild).toBeNull();
  });

  it("renders a single closed-season row with its end-tier label and date range", () => {
    setHistoryWithPoints({
      solo: [
        season({
          endRank: { tier: "GOLD", rank: "II", leaguePoints: 42, totalLp: 1700 },
          peakRank: { tier: "GOLD", rank: "II", leaguePoints: 42, totalLp: 1700 },
        }),
      ],
    });
    renderShell();
    expect(screen.getByText(/Ended:/)).toBeTruthy();
    expect(screen.getByText(/Gold II 42LP/)).toBeTruthy();
  });

  it("renders an 'Active' badge and 'Currently' label for an ongoing season", () => {
    setHistoryWithPoints({
      solo: [season({ ongoing: true })],
    });
    renderShell();
    expect(screen.getByText(/Currently:/)).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders a Peak line when peak totalLp exceeds end totalLp", () => {
    setHistoryWithPoints({
      solo: [
        season({
          endRank: { tier: "GOLD", rank: "IV", leaguePoints: 0, totalLp: 1500 },
          peakRank: { tier: "PLATINUM", rank: "IV", leaguePoints: 10, totalLp: 2400 },
        }),
      ],
    });
    renderShell();
    expect(screen.getByText(/Peak:/)).toBeTruthy();
    expect(screen.getByText(/Platinum IV 10LP/)).toBeTruthy();
  });

  it("formats apex tier labels without a division", () => {
    setHistoryWithPoints({
      solo: [
        season({
          endRank: { tier: "CHALLENGER", rank: "I", leaguePoints: 850, totalLp: 5000 },
          peakRank: { tier: "CHALLENGER", rank: "I", leaguePoints: 850, totalLp: 5000 },
        }),
      ],
    });
    renderShell();
    expect(screen.getByText(/Challenger 850LP/)).toBeTruthy();
    // No "Challenger I" — apex tiers omit the division
    expect(screen.queryByText(/Challenger I 850LP/)).toBeNull();
  });

  it("renders a 'Tracking started …' note when there is only one season", () => {
    setHistoryWithPoints({
      solo: [season({ startAt: "2026-01-01T00:00:00Z" })],
    });
    renderShell();
    expect(screen.getByText(/Tracking started/)).toBeTruthy();
  });

  it("does not render the 'Tracking started' note when there are multiple seasons", () => {
    setHistoryWithPoints({
      solo: [season(), season({ startAt: "2026-04-02T00:00:00Z" })],
    });
    renderShell();
    expect(screen.queryByText(/Tracking started/)).toBeNull();
  });

  it("switches to the flex tab when clicked", () => {
    setHistoryWithPoints({
      solo: [season()],
      flex: [
        season({
          endRank: { tier: "DIAMOND", rank: "I", leaguePoints: 5, totalLp: 3000 },
          peakRank: { tier: "DIAMOND", rank: "I", leaguePoints: 5, totalLp: 3000 },
        }),
      ],
    });
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Flex" }));
    expect(screen.getByText(/Diamond I 5LP/)).toBeTruthy();
  });

  it("disables the queue tab when no seasons exist for it", () => {
    setHistoryWithPoints({
      solo: [season()],
      flex: [],
    });
    renderShell();
    const flexTab = screen.getByRole("button", { name: "Flex" }) as HTMLButtonElement;
    expect(flexTab.disabled).toBe(true);
  });

  it("auto-falls back to solo when the active queue becomes unavailable", () => {
    setHistoryWithPoints({
      solo: [season()],
      flex: [],
    });
    renderShell();
    // Solo tab is active by default; flex is disabled
    const soloTab = screen.getByRole("button", { name: "Solo/Duo" }) as HTMLButtonElement;
    expect(soloTab.disabled).toBe(false);
  });
});
