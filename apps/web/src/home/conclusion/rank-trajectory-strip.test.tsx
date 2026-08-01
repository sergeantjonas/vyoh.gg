import { usePrimaryAccount } from "@/home/use-primary-account";
import { useRankHistory } from "@/lol/profile/use-rank-history";
import { render, screen } from "@testing-library/react";
import {
  type LolAccountWithSummary,
  type RankHistoryResponse,
  emptyRankHistory,
} from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankTrajectoryStrip } from "./rank-trajectory-strip";

vi.mock("@/home/use-primary-account", () => ({ usePrimaryAccount: vi.fn() }));
vi.mock("@/lol/profile/use-rank-history", () => ({ useRankHistory: vi.fn() }));

// `data` names only the ladders a case exercises; the rest fill in empty, so
// adding a ladder to RANKED_QUEUE_KEYS doesn't touch this file.
function mockHooks(opts: {
  account?: LolAccountWithSummary;
  data?: Partial<RankHistoryResponse>;
}) {
  vi.mocked(usePrimaryAccount).mockReturnValue({
    account: opts.account,
    isPending: opts.account === undefined,
  });
  vi.mocked(useRankHistory).mockReturnValue({
    data: opts.data && { ...emptyRankHistory(), ...opts.data },
  } as unknown as ReturnType<typeof useRankHistory>);
}

const account: LolAccountWithSummary = {
  slug: "ahri",
  gameName: "Vyoh",
  tagLine: "Ahri",
  region: "euw1",
  isOwner: true,
  isPrimary: true,
  profileIconId: 7,
  summary: null,
};

afterEach(() => {
  vi.mocked(usePrimaryAccount).mockReset();
  vi.mocked(useRankHistory).mockReset();
});

describe("RankTrajectoryStrip", () => {
  it("renders nothing while the primary account is pending", () => {
    mockHooks({});
    const { container } = render(<RankTrajectoryStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there are fewer than two solo snapshots", () => {
    mockHooks({
      account,
      data: {
        solo: [
          {
            capturedAt: "2026-06-01T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "II",
            leaguePoints: 50,
          },
        ],
        flex: [],
      },
    });
    const { container } = render(<RankTrajectoryStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("renders start rank, end rank, and an LP delta when there are enough points", () => {
    mockHooks({
      account,
      data: {
        solo: [
          {
            capturedAt: "2026-05-01T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "II",
            leaguePoints: 50,
          },
          {
            capturedAt: "2026-05-15T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "II",
            leaguePoints: 80,
          },
          {
            capturedAt: "2026-06-01T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "I",
            leaguePoints: 17,
          },
        ],
        flex: [],
      },
    });
    render(<RankTrajectoryStrip />);
    expect(screen.getByText("Gold II 50LP")).toBeTruthy();
    expect(screen.getByText("Gold I 17LP")).toBeTruthy();
    // Normalized: Gold II 50 → 50; Gold I 17 → 117 → delta +67 LP.
    expect(screen.getByText("+67 LP")).toBeTruthy();
    expect(screen.getByText("Trajectory")).toBeTruthy();
    // Caption is split across the delta span — match by partial text.
    expect(screen.getByText(/Solo queue . last 30 days/)).toBeTruthy();
  });

  it("sorts unordered snapshots chronologically before computing the delta", () => {
    mockHooks({
      account,
      data: {
        solo: [
          {
            capturedAt: "2026-06-01T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "I",
            leaguePoints: 17,
          },
          {
            capturedAt: "2026-05-01T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "II",
            leaguePoints: 50,
          },
        ],
        flex: [],
      },
    });
    render(<RankTrajectoryStrip />);
    // First point chronologically = 2026-05-01 Gold II 50LP.
    expect(screen.getByText("Gold II 50LP")).toBeTruthy();
    expect(screen.getByText("+67 LP")).toBeTruthy();
  });

  it("formats a flat trajectory as ±0 LP", () => {
    mockHooks({
      account,
      data: {
        solo: [
          {
            capturedAt: "2026-05-01T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "II",
            leaguePoints: 50,
          },
          {
            capturedAt: "2026-06-01T00:00:00Z",
            queueId: "RANKED_SOLO_5x5",
            tier: "GOLD",
            rank: "II",
            leaguePoints: 50,
          },
        ],
        flex: [],
      },
    });
    render(<RankTrajectoryStrip />);
    expect(screen.getByText("±0 LP")).toBeTruthy();
  });
});
