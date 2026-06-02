import { usePrimaryAccount } from "@/home/use-primary-account";
import { useLiveGame } from "@/lol/matches/use-live-match";
import { useSteamPlayerState } from "@/steam/use-player-state";
import { render, screen } from "@testing-library/react";
import type { LiveMatch, LolAccountWithSummary, SteamPlayerState } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NowPlayingStrip } from "./now-playing-strip";

vi.mock("@/home/use-primary-account", () => ({ usePrimaryAccount: vi.fn() }));
vi.mock("@/lol/matches/use-live-match", () => ({ useLiveGame: vi.fn() }));
vi.mock("@/steam/use-player-state", () => ({ useSteamPlayerState: vi.fn() }));

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

function mockState(opts: {
  liveGame?: LiveMatch | null;
  steam?: SteamPlayerState;
}) {
  vi.mocked(usePrimaryAccount).mockReturnValue({ account, isPending: false });
  vi.mocked(useLiveGame).mockReturnValue({
    data: opts.liveGame ?? null,
  } as unknown as ReturnType<typeof useLiveGame>);
  vi.mocked(useSteamPlayerState).mockReturnValue({
    data: opts.steam,
  } as unknown as ReturnType<typeof useSteamPlayerState>);
}

const liveGame: LiveMatch = {
  gameId: 999,
  gameStartTime: 0,
  gameLength: 720, // 12 minutes
  polledAt: Date.UTC(2026, 5, 2, 18, 0, 0),
  queueId: 420,
  mapId: 11,
  gameMode: "CLASSIC",
  platformId: "EUW1",
  participants: [],
  bans: [],
};

const steamPlaying: SteamPlayerState = {
  steamId: "76561",
  personaName: "vyoh",
  avatarUrl: "https://test/a.jpg",
  personaState: "online",
  profileVisibility: 3,
  currentGame: { appid: 367520, name: "Hollow Knight" },
  currentGamePlaytimeForeverMinutes: 240,
  lastPolledAt: "2026-06-02T18:00:00Z",
};

beforeEach(() => {
  // Pin Date.now so the elapsed-time formatter is deterministic.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-02T18:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(usePrimaryAccount).mockReset();
  vi.mocked(useLiveGame).mockReset();
  vi.mocked(useSteamPlayerState).mockReset();
});

describe("NowPlayingStrip", () => {
  it("renders nothing when neither stream is live", () => {
    mockState({});
    const { container } = render(<NowPlayingStrip />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the LoL queue label and elapsed minutes when in a live game", () => {
    mockState({ liveGame });
    render(<NowPlayingStrip />);
    expect(screen.getByText("Now playing")).toBeTruthy();
    expect(screen.getByText("Ranked Solo")).toBeTruthy();
    // 720s + 0ms since polledAt = 12m in.
    expect(screen.getByText("12m in")).toBeTruthy();
  });

  it("shows seconds-in when a LoL game has just started", () => {
    mockState({
      liveGame: { ...liveGame, gameLength: 45 },
    });
    render(<NowPlayingStrip />);
    expect(screen.getByText("45s in")).toBeTruthy();
  });

  it("shows the Steam current game name when LoL is idle and Steam reports a game", () => {
    mockState({ steam: steamPlaying });
    render(<NowPlayingStrip />);
    expect(screen.getByText("Hollow Knight")).toBeTruthy();
    expect(screen.getByText("On Steam")).toBeTruthy();
  });

  it("prefers LoL over Steam when both report a live stream", () => {
    mockState({ liveGame, steam: steamPlaying });
    render(<NowPlayingStrip />);
    expect(screen.getByText("Ranked Solo")).toBeTruthy();
    expect(screen.queryByText("Hollow Knight")).toBeNull();
  });

  it("renders nothing when Steam reports null currentGame", () => {
    mockState({ steam: { ...steamPlaying, currentGame: null } });
    const { container } = render(<NowPlayingStrip />);
    expect(container.firstChild).toBeNull();
  });
});
