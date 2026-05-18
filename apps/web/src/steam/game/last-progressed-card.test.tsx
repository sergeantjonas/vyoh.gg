import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { render, screen } from "@testing-library/react";
import type {
  SteamAchievement,
  SteamGameAchievements,
  SteamOwnedGame,
  SteamOwnedGames,
} from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LastProgressedCard } from "./last-progressed-card";
import { useGameAchievements } from "./use-game-achievements";

vi.mock("./use-game-achievements", () => ({
  useGameAchievements: vi.fn(),
}));

vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: vi.fn(),
}));

// Anchor "now" so relativeTimeAgo and compactAgo are deterministic.
const NOW_ISO = "2026-05-19T12:00:00Z";
const NOW_MS = new Date(NOW_ISO).getTime();
const DAY_MS = 86_400_000;

function daysAgoIso(days: number): string {
  return new Date(NOW_MS - days * DAY_MS).toISOString();
}

function makeGame(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Test Game",
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

function mockOwned(games: SteamOwnedGame[]): void {
  const value: { data: SteamOwnedGames; isPending: boolean } = {
    data: { games, lastSyncedAt: NOW_ISO },
    isPending: false,
  };
  vi.mocked(useSteamOwnedGames).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamOwnedGames>
  );
}

function mockAchievements(achievements: SteamAchievement[] | null): void {
  const data: SteamGameAchievements = {
    appid: 440,
    achievements,
    lastSchemaCheckedAt: null,
    lastUnlocksCheckedAt: null,
    lastRarityCheckedAt: null,
  };
  vi.mocked(useGameAchievements).mockReturnValue({
    data,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useGameAchievements>);
}

function ach(overrides: Partial<SteamAchievement> = {}): SteamAchievement {
  return {
    apiName: "A",
    displayName: "A",
    description: "",
    hidden: false,
    unlockedAt: null,
    globalPercent: null,
    ...overrides,
  };
}

function renderCard(): ReturnType<typeof render> {
  return render(
    <MotionConfig reducedMotion="always">
      <LastProgressedCard appid={440} />
    </MotionConfig>
  );
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.mocked(useGameAchievements).mockReset();
  vi.mocked(useSteamOwnedGames).mockReset();
});

describe("LastProgressedCard", () => {
  it("renders nothing when the game is not in the owned-games list", () => {
    mockOwned([]);
    mockAchievements([]);
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there is no launch or unlock timestamp", () => {
    mockOwned([makeGame({ rtimeLastPlayedAt: null })]);
    mockAchievements([ach({ unlockedAt: null })]);
    const { container } = renderCard();
    expect(container.firstChild).toBeNull();
  });

  it("renders the 100% complete verdict when every achievement is unlocked", () => {
    mockOwned([makeGame({ rtimeLastPlayedAt: daysAgoIso(2) })]);
    mockAchievements([
      ach({ apiName: "A1", unlockedAt: daysAgoIso(1) }),
      ach({ apiName: "A2", unlockedAt: daysAgoIso(3) }),
    ]);
    renderCard();
    expect(screen.queryByText(/100% complete/)).not.toBeNull();
  });

  it("renders the 'Stuck at X/Y' verdict for partial completion with a stale last unlock", () => {
    mockOwned([makeGame({ rtimeLastPlayedAt: daysAgoIso(60) })]);
    mockAchievements([
      ach({ apiName: "A1", unlockedAt: daysAgoIso(90) }),
      ach({ apiName: "A2", unlockedAt: null }),
      ach({ apiName: "A3", unlockedAt: null }),
    ]);
    renderCard();
    expect(screen.queryByText(/Stuck at 1\/3/)).not.toBeNull();
  });

  it("renders 'Launching but not progressing' when the game is launched fresh but unlocks are stale", () => {
    mockOwned([makeGame({ rtimeLastPlayedAt: daysAgoIso(3) })]);
    mockAchievements([
      ach({ apiName: "A1", unlockedAt: daysAgoIso(120) }),
      ach({ apiName: "A2", unlockedAt: null }),
    ]);
    renderCard();
    expect(screen.queryByText(/Launching but not progressing/)).not.toBeNull();
  });

  it("renders the launch-only verdict for schema-less titles (achievements === null)", () => {
    mockOwned([makeGame({ rtimeLastPlayedAt: daysAgoIso(5) })]);
    mockAchievements(null);
    renderCard();
    expect(screen.queryByText(/Last launched/)).not.toBeNull();
  });
});
