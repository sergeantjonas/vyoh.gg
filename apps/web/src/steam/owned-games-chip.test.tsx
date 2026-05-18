import { render, screen } from "@testing-library/react";
import type { SteamOwnedGame, SteamOwnedGames } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OwnedGamesChip } from "./owned-games-chip";
import { useSteamOwnedGames } from "./use-owned-games";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-owned-games", () => ({
  useSteamOwnedGames: vi.fn(),
}));

type HookReturn = {
  data: SteamOwnedGames | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useSteamOwnedGames).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamOwnedGames>
  );
}

function makeGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Team Fortress 2",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: null,
    assetUrlFormat: null,
    assetTimestamp: null,
    libraryCapsulePath: null,
    libraryCapsule2xPath: null,
    libraryHeroPath: null,
    libraryHero2xPath: null,
    headerPath: null,
    heroCapsulePath: null,
    logoPath: null,
    appType: 0,
    tagIds: [],
    rtimeLastPlayedAt: null,
    ...overrides,
  };
}

function renderChip() {
  return render(
    <MotionConfig reducedMotion="always">
      <OwnedGamesChip />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useSteamOwnedGames).mockReset();
});

describe("OwnedGamesChip", () => {
  it("renders the loading state while pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderChip();
    expect(screen.getByText("Loading playtime…")).toBeTruthy();
  });

  it("renders an unavailable verdict on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderChip();
    expect(screen.getByText("Playtime is unavailable right now.")).toBeTruthy();
  });

  it("renders the first-poll empty state when no game has playtime", () => {
    mockHook({
      data: {
        games: [makeGame({ playtimeForeverMinutes: 0 })],
        lastSyncedAt: null,
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(
      screen.getByText(/Nothing played yet — first poll lands at 04:00/)
    ).toBeTruthy();
  });

  it("renders the verdict in hours rounded from minutes (60 → 1h)", () => {
    mockHook({
      data: {
        games: [
          makeGame({
            appid: 440,
            name: "Team Fortress 2",
            playtimeForeverMinutes: 600,
          }),
        ],
        lastSyncedAt: "2026-05-19T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("10h into Team Fortress 2.")).toBeTruthy();
    expect(screen.getByText("Most-played of 1 ever-launched title.")).toBeTruthy();
  });

  it("pluralizes 'titles' when there are 2+ ever-launched games", () => {
    mockHook({
      data: {
        games: [
          makeGame({ appid: 1, name: "First", playtimeForeverMinutes: 6000 }),
          makeGame({ appid: 2, name: "Second", playtimeForeverMinutes: 60 }),
        ],
        lastSyncedAt: "2026-05-19T00:00:00Z",
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Most-played of 2 ever-launched titles.")).toBeTruthy();
  });
});
