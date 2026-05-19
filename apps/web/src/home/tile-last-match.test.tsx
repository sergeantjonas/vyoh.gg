import { useMatches } from "@/lol/matches/use-matches";
import { render, screen } from "@testing-library/react";
import type { LolAccount, MatchSummary } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TileLastMatch } from "./tile-last-match";

vi.mock("@/lol/matches/use-matches", () => ({ useMatches: vi.fn() }));
vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));
vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => (
    <img alt={alt} data-testid="champ-icon" />
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

const NOW = new Date("2026-05-19T12:00:00.000Z").getTime();

function makeMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "EUW1_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    durationSec: 1834,
    playedAt: new Date(NOW - 10 * 60_000).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "14.20.586.5840",
    visionScore: 30,
    damageShare: 0.25,
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
    ...overrides,
  };
}

function mockMatches(value: {
  data?: { pages: MatchSummary[][] } | undefined;
  isPending: boolean;
}) {
  vi.mocked(useMatches).mockReturnValue(
    value as unknown as ReturnType<typeof useMatches>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(useMatches).mockReset();
});

describe("TileLastMatch", () => {
  it("renders the no-account verdict when no account is connected", () => {
    render(<TileLastMatch account={undefined} />);
    expect(screen.getByText("No account connected yet.")).toBeTruthy();
  });

  it("renders the loading verdict while matches are pending", () => {
    mockMatches({ data: undefined, isPending: true });
    render(<TileLastMatch account={account} />);
    expect(screen.getByText("Loading recent play…")).toBeTruthy();
  });

  it("renders the no-recent-games verdict when matches resolve empty", () => {
    mockMatches({ data: { pages: [[]] }, isPending: false });
    render(<TileLastMatch account={account} />);
    expect(screen.getByText("No recent games tracked.")).toBeTruthy();
  });

  it("skips remakes and renders the latest non-remake as Win/Loss", () => {
    const remake = makeMatch({ matchId: "R", remake: true });
    const real = makeMatch({ matchId: "L1", win: false });
    mockMatches({ data: { pages: [[remake, real]] }, isPending: false });
    render(<TileLastMatch account={account} />);
    expect(screen.getByText(/Loss on Ahri/)).toBeTruthy();
    expect(screen.getByText(/8\/3\/12/)).toBeTruthy();
  });

  it("renders the deep-link to the match-detail route", () => {
    mockMatches({ data: { pages: [[makeMatch()]] }, isPending: false });
    const { container } = render(<TileLastMatch account={account} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
  });

  it("renders the no-recent-games verdict when every page entry is a remake", () => {
    mockMatches({
      data: { pages: [[makeMatch({ remake: true })]] },
      isPending: false,
    });
    render(<TileLastMatch account={account} />);
    expect(screen.getByText("No recent games tracked.")).toBeTruthy();
  });

  it("formats a match played a few hours ago as 'Xh ago'", () => {
    mockMatches({
      data: {
        pages: [[makeMatch({ playedAt: new Date(NOW - 3 * 60 * 60_000).toISOString() })]],
      },
      isPending: false,
    });
    render(<TileLastMatch account={account} />);
    expect(screen.getByText(/3h ago/)).toBeTruthy();
  });

  it("formats a match played several days ago as 'Xd ago'", () => {
    mockMatches({
      data: {
        pages: [
          [makeMatch({ playedAt: new Date(NOW - 2 * 24 * 60 * 60_000).toISOString() })],
        ],
      },
      isPending: false,
    });
    render(<TileLastMatch account={account} />);
    expect(screen.getByText(/2d ago/)).toBeTruthy();
  });
});
