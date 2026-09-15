import { render } from "@testing-library/react";
import type { LolAccountWithSummary, Me } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useMeMock = vi.fn();
const useLiveGameMock = vi.fn();
const useSteamPlayerStateMock = vi.fn();
const useSessionsPresenceSyncMock = vi.fn();

vi.mock("@/identity/use-me", () => ({
  useMe: () => useMeMock(),
}));
vi.mock("@/lol/matches/use-live-match", () => ({
  useLiveGame: (account: unknown, options?: unknown) => useLiveGameMock(account, options),
}));
vi.mock("@/steam/use-player-state", () => ({
  useSteamPlayerState: () => useSteamPlayerStateMock(),
}));
vi.mock("@/steam/sessions/use-sessions-presence-sync", () => ({
  useSessionsPresenceSync: (state: unknown, scope: unknown) =>
    useSessionsPresenceSyncMock(state, scope),
}));
vi.mock("@/auth/use-viewer", () => ({
  useIsOwner: () => false,
}));

import { PresenceMounts } from "./presence-mounts";

function makeAccount(slug: string): LolAccountWithSummary {
  return {
    slug,
    gameName: slug,
    tagLine: "EUW",
    region: "europe",
    profileIconId: null,
    summary: null,
  };
}

const PLAYER_STATE = { currentGame: null };

beforeEach(() => {
  useSteamPlayerStateMock.mockReturnValue({ data: PLAYER_STATE });
});

afterEach(() => {
  useMeMock.mockReset();
  useLiveGameMock.mockReset();
  useSteamPlayerStateMock.mockReset();
  useSessionsPresenceSyncMock.mockReset();
});

describe("PresenceMounts", () => {
  it("subscribes to Steam player-state regardless of LoL accounts", () => {
    useMeMock.mockReturnValue({ data: undefined });
    render(<PresenceMounts />);
    expect(useSteamPlayerStateMock).toHaveBeenCalled();
    expect(useSessionsPresenceSyncMock).toHaveBeenCalledWith(PLAYER_STATE, "public");
    expect(useLiveGameMock).not.toHaveBeenCalled();
  });

  it("polls live-game per LoL account on a 60s interval", () => {
    const me: Me = { lol: [makeAccount("alpha"), makeAccount("beta")], steam: [] };
    useMeMock.mockReturnValue({ data: me });
    render(<PresenceMounts />);
    expect(useLiveGameMock).toHaveBeenCalledTimes(2);
    const calls = useLiveGameMock.mock.calls.map(([acc, opts]) => ({
      slug: (acc as LolAccountWithSummary).slug,
      opts,
    }));
    expect(calls).toEqual([
      { slug: "alpha", opts: { refetchIntervalMs: 60_000 } },
      { slug: "beta", opts: { refetchIntervalMs: 60_000 } },
    ]);
  });

  it("renders nothing", () => {
    useMeMock.mockReturnValue({ data: { lol: [makeAccount("alpha")], steam: [] } });
    const { container } = render(<PresenceMounts />);
    expect(container.innerHTML).toBe("");
  });
});
