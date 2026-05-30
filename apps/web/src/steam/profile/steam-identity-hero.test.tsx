import { SectionShellProvider } from "@/_shared/section-layout/section-shell-context";
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
// The hero renders <SteamStatBand>, which reads the library summary — stub it
// so the child doesn't make a real fetch in these hero-focused tests.
vi.mock("@/steam/use-library-summary", () => ({
  useSteamLibrarySummary: () => ({
    data: {
      ownedCount: 175,
      everLaunchedCount: 72,
      untouchedCount: 103,
      lastSyncedAt: "2026-05-30T00:00:00.000Z",
    },
  }),
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

function renderHero({ compact = false } = {}) {
  // The hero reads `compact` from the section shell to yield its identity to
  // the strip morph; provide it so the hook doesn't throw.
  return render(
    <SectionShellProvider value={{ compact }}>
      <MotionConfig reducedMotion="always">
        <SteamIdentityHero />
      </MotionConfig>
    </SectionShellProvider>
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

  it("wears a sky activity ring when online (Steam brand colour, not emerald)", () => {
    summaryMock.mockReturnValue(summary({ personaState: "online" }));
    const { container } = renderHero();
    const avatar = container.querySelector<HTMLImageElement>(
      'img[data-presence="online"]'
    );
    expect(avatar).toBeTruthy();
    expect(avatar?.className).toContain("ring-sky-400");
    // Emerald is reserved for in-game / live activity — should NOT leak onto
    // the online state.
    expect(avatar?.className).not.toContain("ring-emerald-400");
  });

  it("maps each non-online persona state to its ring colour", () => {
    const cases: Array<[SteamSummary["personaState"], string]> = [
      ["busy", "ring-rose-400"],
      ["away", "ring-amber-400"],
      ["snooze", "ring-amber-400"],
      ["looking-to-trade", "ring-sky-400"],
      ["looking-to-play", "ring-sky-400"],
      ["offline", "ring-white/15"],
    ];
    for (const [state, ringClass] of cases) {
      summaryMock.mockReturnValue(summary({ personaState: state }));
      const { container, unmount } = renderHero();
      const avatar = container.querySelector<HTMLImageElement>(
        `img[data-presence="${state}"]`
      );
      expect(avatar, `expected avatar for state=${state}`).toBeTruthy();
      expect(
        avatar?.className.includes(ringClass),
        `expected ${state} → ${ringClass}, got ${avatar?.className}`
      ).toBe(true);
      unmount();
    }
  });

  it("overrides the persona ring with an emerald activity ring + pulse when in-game", () => {
    summaryMock.mockReturnValue(summary({ personaState: "online" }));
    playerStateMock.mockReturnValue(
      playerState({
        personaState: "online",
        currentGame: { appid: 440, name: "Team Fortress 2" },
      })
    );
    const { container } = renderHero();
    const avatar = container.querySelector<HTMLImageElement>(
      'img[data-presence="in-game"]'
    );
    expect(avatar).toBeTruthy();
    expect(avatar?.className).toContain("ring-emerald-400");
    // Live activity gets a sibling breathing halo behind the avatar.
    // `useReducedMotion()` reads the OS media query (NOT MotionConfig), so it
    // returns false under happy-dom and the halo renders in tests.
    expect(
      container.querySelector("span.animate-pulse.bg-emerald-400\\/40")
    ).toBeTruthy();
  });

  it("keeps the headline visible at scroll-top (not compact)", () => {
    renderHero();
    expect(screen.getByRole("heading", { level: 2 }).className).not.toContain(
      "opacity-0"
    );
  });

  it("hides its avatar + name when compact so the strip morph owns the identity", () => {
    const { container } = renderHero({ compact: true });
    // Name fades out; only opacity changes (the box stays laid out as the
    // shared-layout morph source for the strip copy).
    expect(screen.getByRole("heading", { level: 2 }).className).toContain("opacity-0");
    // Avatar wrapper (the element wrapping the persona avatar) also fades.
    const avatar = container.querySelector<HTMLImageElement>("img[data-presence]");
    expect(avatar?.parentElement?.className).toContain("opacity-0");
  });

  it("marks its avatar + name as the cross-nav identity owner when not compact", () => {
    const { container } = renderHero({ compact: false });
    expect(container.querySelector("[data-identity-avatar]")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2 }).hasAttribute("data-identity-name")
    ).toBe(true);
  });

  it("drops the identity markers when compact so the strip owns them", () => {
    const { container } = renderHero({ compact: true });
    expect(container.querySelector("[data-identity-avatar]")).toBeNull();
    expect(container.querySelector("[data-identity-name]")).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = renderHero();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
