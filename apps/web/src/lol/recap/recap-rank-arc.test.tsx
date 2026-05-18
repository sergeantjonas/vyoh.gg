import { useRankHistory } from "@/lol/profile/use-rank-history";
import { render, screen } from "@testing-library/react";
import type { LolAccount, RankHistoryResponse } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecapRankArc } from "./recap-rank-arc";

vi.mock("@/lol/profile/use-rank-history", () => ({
  useRankHistory: vi.fn(),
}));

const account: LolAccount = {
  region: "euw1",
  gameName: "Jonas",
  tagLine: "EUW",
  slug: "jonas-euw",
};

function mockHistory(value: RankHistoryResponse | undefined): void {
  vi.mocked(useRankHistory).mockReturnValue({
    data: value,
  } as unknown as ReturnType<typeof useRankHistory>);
}

function renderArc(acc: LolAccount | undefined = account) {
  return render(
    <MotionConfig reducedMotion="always">
      <RecapRankArc account={acc} />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useRankHistory).mockReset();
});

describe("RecapRankArc", () => {
  it("renders the empty state when the query hasn't returned yet", () => {
    mockHistory(undefined);
    renderArc();
    expect(screen.getByText("Not enough rank snapshots yet")).toBeTruthy();
  });

  it("renders the empty state when both solo and flex history are empty", () => {
    mockHistory({ solo: [], flex: [] });
    renderArc();
    expect(screen.getByText("Not enough rank snapshots yet")).toBeTruthy();
  });

  it("renders the peak (highest normalized LP across solo + flex)", () => {
    // Solo peak: GOLD I 50 = 3*400 + 300 + 50 = 1550
    // Flex peak: PLATINUM IV 10 = 4*400 + 0 + 10 = 1610 → flex wins overall peak.
    mockHistory({
      solo: [
        {
          capturedAt: "2026-01-01T00:00:00Z",
          queueId: "420",
          tier: "GOLD",
          rank: "I",
          leaguePoints: 50,
        },
      ],
      flex: [
        {
          capturedAt: "2026-02-01T00:00:00Z",
          queueId: "440",
          tier: "PLATINUM",
          rank: "IV",
          leaguePoints: 10,
        },
      ],
    });
    renderArc();
    expect(screen.getByText("Platinum IV 10LP")).toBeTruthy();
  });

  it("shows the net solo LP delta with a + sign when the player gained", () => {
    // First: SILVER IV 50 = 2*400 + 0 + 50 = 850. Last: GOLD II 0 = 3*400 + 200 + 0 = 1400. Δ = +550.
    mockHistory({
      solo: [
        {
          capturedAt: "2026-01-01T00:00:00Z",
          queueId: "420",
          tier: "SILVER",
          rank: "IV",
          leaguePoints: 50,
        },
        {
          capturedAt: "2026-02-01T00:00:00Z",
          queueId: "420",
          tier: "GOLD",
          rank: "II",
          leaguePoints: 0,
        },
      ],
      flex: [],
    });
    // "+", "350", " LP" render as separate text nodes — check the container's textContent.
    const { container } = renderArc();
    expect(container.textContent).toContain("+550 LP");
  });

  it("shows a negative solo LP delta without a synthesized '+'", () => {
    // First: GOLD II 50 = 1450. Last: GOLD IV 50 = 1250. Δ = -200.
    mockHistory({
      solo: [
        {
          capturedAt: "2026-01-01T00:00:00Z",
          queueId: "420",
          tier: "GOLD",
          rank: "II",
          leaguePoints: 50,
        },
        {
          capturedAt: "2026-02-01T00:00:00Z",
          queueId: "420",
          tier: "GOLD",
          rank: "IV",
          leaguePoints: 50,
        },
      ],
      flex: [],
    });
    const { container } = renderArc();
    expect(container.textContent).toContain("-200 LP");
  });

  it("reports the count of detected seasons in the tracked-seasons tile", () => {
    // Single snapshot → detectSeasons returns one segment → "1 closed".
    mockHistory({
      solo: [
        {
          capturedAt: "2026-01-01T00:00:00Z",
          queueId: "420",
          tier: "GOLD",
          rank: "II",
          leaguePoints: 50,
        },
      ],
      flex: [],
    });
    renderArc();
    expect(screen.getByText("1 closed")).toBeTruthy();
  });
});
