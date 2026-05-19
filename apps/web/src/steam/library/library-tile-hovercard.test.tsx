import { render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryTileHovercardContent } from "./library-tile-hovercard";
import { useGameMedia } from "./use-game-media";

vi.mock("./use-game-media", () => ({
  useGameMedia: vi.fn(),
}));

function mockMedia(screenshots: { thumbUrl: string; fullUrl?: string }[] = []) {
  vi.mocked(useGameMedia).mockReturnValue({
    data: { screenshots },
  } as unknown as ReturnType<typeof useGameMedia>);
}

function game(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Team Fortress 2",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    ...overrides,
  } as SteamOwnedGame;
}

beforeEach(() => {
  mockMedia([]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-19T12:00:00Z"));
});

afterEach(() => {
  vi.mocked(useGameMedia).mockReset();
  vi.useRealTimers();
});

describe("LibraryTileHovercardContent", () => {
  it("renders '0 min' under Total when the game has never been launched", () => {
    render(<LibraryTileHovercardContent game={game()} />);
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getAllByText("0 min").length).toBeGreaterThan(0);
  });

  it("renders minutes precision under 60 minutes", () => {
    render(<LibraryTileHovercardContent game={game({ playtimeForeverMinutes: 45 })} />);
    expect(screen.getByText("45 min")).toBeTruthy();
  });

  it("renders tenths-of-hour precision under 10 hours", () => {
    render(<LibraryTileHovercardContent game={game({ playtimeForeverMinutes: 204 })} />);
    expect(screen.getByText("3.4 hrs")).toBeTruthy();
  });

  it("renders whole-hour precision at or above 10 hours", () => {
    render(
      <LibraryTileHovercardContent game={game({ playtimeForeverMinutes: 6_000 })} />
    );
    expect(screen.getByText("100 hrs")).toBeTruthy();
  });

  it("omits the 'Last played' row when rtimeLastPlayedAt is null", () => {
    const { container } = render(
      <LibraryTileHovercardContent game={game({ rtimeLastPlayedAt: null })} />
    );
    expect(container.textContent).not.toContain("Last played");
  });

  it("renders a relative-time 'Last played' line when the timestamp is set", () => {
    // 10 days before the system time → "10 days ago".
    const tenDaysAgo = new Date("2026-05-09T12:00:00Z").toISOString();
    const { container } = render(
      <LibraryTileHovercardContent
        game={game({ rtimeLastPlayedAt: tenDaysAgo, playtimeForeverMinutes: 30 })}
      />
    );
    expect(container.textContent).toContain("Last played");
    expect(container.textContent).toMatch(/10 days ago/);
  });
});
