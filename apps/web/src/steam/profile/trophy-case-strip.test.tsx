import { useCrossGameRarest } from "@/steam/use-cross-game-rarest";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { render, screen } from "@testing-library/react";
import type { SteamOwnedGame, SteamRecentUnlock } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrophyCaseStrip } from "./trophy-case-strip";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/steam/use-cross-game-rarest", () => ({
  useCrossGameRarest: vi.fn(),
}));

vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: vi.fn(),
}));

vi.mock("@/steam/profile-backdrop", () => ({
  prefetchSteamGameBackdrop: vi.fn(),
}));

vi.mock("embla-carousel-autoplay", () => ({
  default: () => ({
    name: "autoplay",
    options: {},
    init: () => {},
    destroy: () => {},
  }),
}));

function unlock(overrides: Partial<SteamRecentUnlock> = {}): SteamRecentUnlock {
  return {
    appid: 440,
    gameName: "Team Fortress 2",
    apiName: "ACH_1",
    displayName: "First Blood",
    description: "",
    iconUrl: "",
    iconGrayUrl: "",
    unlockedAt: "2026-05-01T00:00:00Z",
    globalPercent: 3,
    ...overrides,
  } as SteamRecentUnlock;
}

function game(appid: number): SteamOwnedGame {
  return {
    appid,
    name: `Game ${appid}`,
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: 12345,
    tagIds: [],
  } as unknown as SteamOwnedGame;
}

function mockData(value: {
  rarest?: { data?: { unlocks: SteamRecentUnlock[] } };
  owned?: { data?: { games: SteamOwnedGame[] } };
}) {
  vi.mocked(useCrossGameRarest).mockReturnValue({
    data: value.rarest?.data,
  } as unknown as ReturnType<typeof useCrossGameRarest>);
  vi.mocked(useSteamOwnedGames).mockReturnValue({
    data: value.owned?.data,
  } as unknown as ReturnType<typeof useSteamOwnedGames>);
}

afterEach(() => {
  vi.mocked(useCrossGameRarest).mockReset();
  vi.mocked(useSteamOwnedGames).mockReset();
});

describe("TrophyCaseStrip", () => {
  it("renders nothing when the rarest query hasn't returned yet", () => {
    mockData({ owned: { data: { games: [] } } });
    const { container } = render(<TrophyCaseStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when owned games aren't loaded yet", () => {
    mockData({ rarest: { data: { unlocks: [] } } });
    const { container } = render(<TrophyCaseStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when all unlocks are at or above the 10% rarity gate", () => {
    mockData({
      rarest: { data: { unlocks: [unlock({ globalPercent: 12 })] } },
      owned: { data: { games: [game(440)] } },
    });
    const { container } = render(<TrophyCaseStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the trophy case header and rare unlock tiles when entries are below 10%", () => {
    mockData({
      rarest: {
        data: {
          unlocks: [
            unlock({ apiName: "A1", displayName: "Rare One", globalPercent: 3 }),
            unlock({ apiName: "A2", displayName: "Sub-Rare", globalPercent: 0.5 }),
            unlock({ apiName: "A3", displayName: "Above Gate", globalPercent: 11 }),
          ],
        },
      },
      owned: { data: { games: [game(440)] } },
    });
    render(<TrophyCaseStrip />);
    expect(screen.getByText("Trophy case")).toBeTruthy();
    expect(screen.getByText("Rare One")).toBeTruthy();
    expect(screen.getByText("Sub-Rare")).toBeTruthy();
    expect(screen.queryByText("Above Gate")).toBeNull();
    expect(screen.getByText("See full signature →")).toBeTruthy();
  });

  it("renders prev/next carousel controls with aria-labels", () => {
    mockData({
      rarest: { data: { unlocks: [unlock()] } },
      owned: { data: { games: [game(440)] } },
    });
    render(<TrophyCaseStrip />);
    expect(screen.getByLabelText("Previous trophies")).toBeTruthy();
    expect(screen.getByLabelText("Next trophies")).toBeTruthy();
  });
});
