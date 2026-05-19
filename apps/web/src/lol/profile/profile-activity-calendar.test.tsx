import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useCachedMatchesWindow } from "@/lol/matches/use-matches";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileActivityCalendar } from "./profile-activity-calendar";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

vi.mock("@/lol/matches/use-matches", () => ({
  useCachedMatchesWindow: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function mockData(matches: MatchSummary[] | undefined): void {
  vi.mocked(useAccountFromSlug).mockReturnValue(account);
  vi.mocked(useCachedMatchesWindow).mockReturnValue({
    data: matches !== undefined ? { matches, total: matches.length } : undefined,
  } as unknown as ReturnType<typeof useCachedMatchesWindow>);
}

function match(daysAgo: number, idx: number): MatchSummary {
  const ts = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    durationSec: 1800,
    playedAt: ts,
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  };
}

function renderCalendar() {
  return render(
    <TooltipPrimitive.Provider>
      <ProfileActivityCalendar accountSlug="jonas-euw" />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  vi.mocked(useAccountFromSlug).mockReset();
  vi.mocked(useCachedMatchesWindow).mockReset();
});

describe("ProfileActivityCalendar", () => {
  it("renders nothing when there are no matches", () => {
    mockData([]);
    const { container } = renderCalendar();
    expect(container.firstChild).toBeNull();
  });

  it("renders the Activity heading when matches exist", () => {
    const matches = [match(1, 0), match(30, 1)];
    mockData(matches);
    renderCalendar();
    expect(screen.getByText("Activity")).toBeTruthy();
  });

  it("omits the capped-window line when the oldest match is older than 365 days", () => {
    // oldest match 400 days ago → startDate falls back to fullYearAgo → no capping.
    const matches = [match(1, 0), match(400, 1)];
    mockData(matches);
    renderCalendar();
    expect(screen.queryByText(/days · from/)).toBeNull();
  });

  it("renders the capped window line when the oldest match is younger than 365 days", () => {
    // 60 days back is well inside the year → capped window triggers.
    const matches = [match(1, 0), match(60, 1)];
    mockData(matches);
    renderCalendar();
    expect(screen.getByText(/days · from/)).toBeTruthy();
  });
});
