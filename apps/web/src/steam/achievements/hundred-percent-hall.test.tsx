import { useLibraryCompletion } from "@/steam/use-library-completion";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { render, screen } from "@testing-library/react";
import type { SteamGameCompletion, SteamOwnedGame } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HundredPercentHall } from "./hundred-percent-hall";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/steam/use-library-completion", () => ({
  useLibraryCompletion: vi.fn(),
}));

vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: vi.fn(),
}));

function game(appid: number, name: string): SteamOwnedGame {
  return {
    appid,
    name,
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    libraryCapsulePath: null,
    tagIds: [],
  } as unknown as SteamOwnedGame;
}

function stat(
  appid: number,
  unlocked: number,
  total: number,
  lastUnlockedAt: string | null = null
): SteamGameCompletion {
  return {
    appid,
    unlocked,
    total,
    lastUnlockedAt,
  } as unknown as SteamGameCompletion;
}

function mock(
  completion: {
    data?: { stats: SteamGameCompletion[] };
    isPending?: boolean;
    isError?: boolean;
  },
  owned: { data?: { games: SteamOwnedGame[] }; isPending?: boolean; isError?: boolean }
) {
  vi.mocked(useLibraryCompletion).mockReturnValue({
    data: completion.data,
    isPending: completion.isPending ?? false,
    isError: completion.isError ?? false,
  } as unknown as ReturnType<typeof useLibraryCompletion>);
  vi.mocked(useSteamOwnedGames).mockReturnValue({
    data: owned.data,
    isPending: owned.isPending ?? false,
    isError: owned.isError ?? false,
  } as unknown as ReturnType<typeof useSteamOwnedGames>);
}

afterEach(() => {
  vi.mocked(useLibraryCompletion).mockReset();
  vi.mocked(useSteamOwnedGames).mockReset();
});

describe("HundredPercentHall", () => {
  it("renders nothing while completion data is pending", () => {
    mock({ isPending: true }, { data: { games: [] } });
    const { container } = render(<HundredPercentHall />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on completion error", () => {
    mock({ isError: true }, { data: { games: [] } });
    const { container } = render(<HundredPercentHall />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there are no 100%'d entries", () => {
    mock(
      { data: { stats: [stat(1, 5, 10), stat(2, 0, 10)] } },
      { data: { games: [game(1, "A"), game(2, "B")] } }
    );
    const { container } = render(<HundredPercentHall />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all 100%'d entries with the section count and per-row achievement label", () => {
    mock(
      {
        data: {
          stats: [
            stat(1, 10, 10, "2026-05-01T00:00:00Z"),
            stat(2, 25, 25, "2026-04-15T00:00:00Z"),
            stat(3, 1, 1),
          ],
        },
      },
      {
        data: {
          games: [game(1, "Portal"), game(2, "Half-Life 2"), game(3, "Mini Game")],
        },
      }
    );
    render(<HundredPercentHall />);
    expect(screen.getByText("Portal")).toBeTruthy();
    expect(screen.getByText("Half-Life 2")).toBeTruthy();
    expect(screen.getByText("Mini Game")).toBeTruthy();
    expect(screen.getByText("10 achievements")).toBeTruthy();
    expect(screen.getByText("1 achievement")).toBeTruthy();
    // Section heading text + count.
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("orders entries by lastUnlockedAt descending with no-date entries at the bottom", () => {
    mock(
      {
        data: {
          stats: [
            stat(1, 5, 5, "2026-01-01T00:00:00Z"),
            stat(2, 5, 5, "2026-05-01T00:00:00Z"),
            stat(3, 5, 5),
          ],
        },
      },
      {
        data: {
          games: [game(1, "January"), game(2, "May"), game(3, "Undated")],
        },
      }
    );
    const { container } = render(<HundredPercentHall />);
    const items = container.querySelectorAll("li");
    expect(items[0]?.textContent).toContain("May");
    expect(items[1]?.textContent).toContain("January");
    expect(items[2]?.textContent).toContain("Undated");
  });
});
