import { render, screen } from "@testing-library/react";
import type { SteamOwnedGames, SteamPlayerState, SteamSummary } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SteamIdentityHero } from "./steam-identity-hero";

const summaryMock = vi.fn();
const playerStateMock = vi.fn();
const ownedMock = vi.fn();

vi.mock("@/steam/use-steam-summary", () => ({
  useSteamSummary: () => ({ data: summaryMock() }),
}));
vi.mock("@/steam/use-player-state", () => ({
  useSteamPlayerState: () => ({ data: playerStateMock() }),
}));
vi.mock("@/steam/use-owned-games", () => ({
  useSteamOwnedGames: () => ({ data: ownedMock() }),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function summary(overrides: Partial<SteamSummary> = {}): SteamSummary {
  return {
    steamId: "76561198020053778",
    personaName: "Vyoh",
    profileUrl: "https://steamcommunity.com/id/vyoh/",
    avatarUrl: "https://example.com/avatar_full.jpg",
    personaState: "offline",
    currentGame: null,
    memberSinceUnix: 1263864425, // 2010-01-19
    steamLevel: 14,
    steamLevelPercentile: 94.66,
    privacyPrereqs: { profilePublic: true, gameDetailsPublic: "unknown" },
    ...overrides,
  };
}

function owned(appid = 1245620): SteamOwnedGames {
  return {
    steamId: "76561198020053778",
    games: [{ appid, name: "ELDEN RING", assetTimestamp: 99 }],
    fetchedAt: new Date().toISOString(),
  } as unknown as SteamOwnedGames;
}

function playerState(overrides: Partial<SteamPlayerState> = {}): SteamPlayerState {
  return {
    steamId: "76561198020053778",
    personaName: "Vyoh",
    avatarUrl: "https://example.com/avatar_full.jpg",
    personaState: "offline",
    profileVisibility: 3,
    currentGame: null,
    currentGamePlaytimeForeverMinutes: null,
    lastPolledAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderHero() {
  return render(
    <MotionConfig reducedMotion="always">
      <SteamIdentityHero />
    </MotionConfig>
  );
}

beforeEach(() => {
  summaryMock.mockReturnValue(summary());
  playerStateMock.mockReturnValue(playerState());
  ownedMock.mockReturnValue(owned());
});

describe("SteamIdentityHero", () => {
  it("renders the persona name", () => {
    renderHero();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Vyoh");
  });

  it("renders the member-since year, level, and top-percentile headline", () => {
    renderHero();
    expect(screen.getByText("Member since 2010")).toBeTruthy();
    expect(screen.getByText("Level 14")).toBeTruthy();
    // 100 - 94.66 = 5.34 → rounds to 5%.
    expect(screen.getByText("top 5%")).toBeTruthy();
  });

  it("omits headline segments that are absent (privacy-locked)", () => {
    // Build a summary with the three optional fields genuinely absent (not set
    // to undefined, which exactOptionalPropertyTypes rejects).
    const {
      memberSinceUnix: _m,
      steamLevel: _l,
      steamLevelPercentile: _p,
      ...bare
    } = summary();
    summaryMock.mockReturnValue(bare);
    renderHero();
    expect(screen.queryByText(/Member since/)).toBeNull();
    expect(screen.queryByText(/Level/)).toBeNull();
    expect(screen.queryByText(/top/)).toBeNull();
  });

  it("shows the persona-state presence label when not in-game", () => {
    summaryMock.mockReturnValue(summary({ personaState: "online" }));
    renderHero();
    expect(screen.getByText("Online")).toBeTruthy();
  });

  it("folds the poller staleness into the presence line", () => {
    // Folded in from the deleted NowPlayingChip — its one unique signal.
    playerStateMock.mockReturnValue(
      playerState({ lastPolledAt: new Date(Date.now() - 5 * 60_000).toISOString() })
    );
    renderHero();
    expect(screen.getByText(/checked 5m ago/)).toBeTruthy();
  });

  it("shows the live now-playing line when in-game", () => {
    playerStateMock.mockReturnValue(
      playerState({ currentGame: { appid: 440, name: "Team Fortress 2" } })
    );
    renderHero();
    expect(screen.getByText(/Now playing Team Fortress 2/)).toBeTruthy();
  });

  it("uses the current game's hero art as the backdrop when in-game", () => {
    playerStateMock.mockReturnValue(
      playerState({ currentGame: { appid: 440, name: "Team Fortress 2" } })
    );
    const { container } = renderHero();
    expect(container.querySelector('img[src*="/hero/noflip/440/"]')).toBeTruthy();
  });

  it("falls back to the most-played game's hero art when not in-game", () => {
    const { container } = renderHero();
    expect(container.querySelector('img[src*="/hero/noflip/1245620/"]')).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = renderHero();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
