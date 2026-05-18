import { render, screen } from "@testing-library/react";
import type { SteamPlayerState } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NowPlayingChip } from "./now-playing-chip";
import { useSteamPlayerState } from "./use-player-state";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-player-state", () => ({
  useSteamPlayerState: vi.fn(),
}));

type HookReturn = {
  data: SteamPlayerState | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useSteamPlayerState).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamPlayerState>
  );
}

function makeState(overrides: Partial<SteamPlayerState> = {}): SteamPlayerState {
  return {
    steamId: "76561198000000000",
    personaName: "Tester",
    avatarUrl: "https://example.com/a.png",
    personaState: "online",
    profileVisibility: 3,
    currentGame: null,
    currentGamePlaytimeForeverMinutes: null,
    lastPolledAt: "2026-05-19T11:55:00Z",
    ...overrides,
  };
}

function renderChip() {
  return render(
    <MotionConfig reducedMotion="always">
      <NowPlayingChip />
    </MotionConfig>
  );
}

// Anchor "now" so relativeTimeSince renders deterministic copy.
const NOW_ISO = "2026-05-19T12:00:00Z";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_ISO));
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.mocked(useSteamPlayerState).mockReset();
});

describe("NowPlayingChip", () => {
  it("renders the loading verdict while the query is pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderChip();
    expect(screen.getByText("Checking presence…")).toBeTruthy();
  });

  it("renders an unavailable verdict on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderChip();
    expect(screen.getByText("Presence is unavailable right now.")).toBeTruthy();
  });

  it("renders the not-in-game verdict + persona indicator when no currentGame", () => {
    mockHook({
      data: makeState({ personaState: "online", currentGame: null }),
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Not in a game right now.")).toBeTruthy();
    expect(screen.getByText("Online")).toBeTruthy();
  });

  it("respects every persona label (snooze, looking-to-play, etc.)", () => {
    mockHook({
      data: makeState({ personaState: "looking-to-play", currentGame: null }),
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("LFG")).toBeTruthy();
  });

  it("renders the in-game hero card with the game name when currentGame is set", () => {
    mockHook({
      data: makeState({
        currentGame: { appid: 440, name: "Team Fortress 2" },
        currentGamePlaytimeForeverMinutes: 6000,
      }),
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Team Fortress 2")).toBeTruthy();
  });
});
