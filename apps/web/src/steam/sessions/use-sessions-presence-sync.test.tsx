import type { ViewerScope } from "@/auth/viewer-scope";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { SteamPlayerState } from "@vyoh/shared";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useSessionsPresenceSync } from "./use-sessions-presence-sync";

const POLLED_AT = "2026-09-22T22:26:00.000Z";
const OPEN = {
  currentGame: { appid: 2638890, name: "Onimusha" },
  lastPolledAt: POLLED_AT,
} as unknown as SteamPlayerState;
const OTHER = {
  currentGame: { appid: 1245620, name: "Elden Ring" },
  lastPolledAt: POLLED_AT,
} as unknown as SteamPlayerState;
const IDLE = {
  currentGame: null,
  lastPolledAt: POLLED_AT,
} as unknown as SteamPlayerState;

const PAGE_KEY = ["steam", "sessions", 12, "public"];
const CHIP_KEY = ["steam", "sessions", 4, "owner"];
const PLAYER_KEY = ["steam", "player-state", "public"];

type Props = { state: SteamPlayerState | undefined; scope: ViewerScope };

function setup(initial: Props) {
  const client = new QueryClient();
  for (const key of [PAGE_KEY, CHIP_KEY, PLAYER_KEY]) client.setQueryData(key, {});
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ state, scope }: Props) => useSessionsPresenceSync(state, scope),
    {
      wrapper,
      initialProps: initial,
    }
  );
  const stale = (key: unknown[]) => client.getQueryState(key)?.isInvalidated === true;
  return { ...hook, stale };
}

describe("useSessionsPresenceSync", () => {
  it("marks every sessions window stale when a game opens", () => {
    const { rerender, stale } = setup({ state: IDLE, scope: "public" });
    rerender({ state: OPEN, scope: "public" });
    expect(stale(PAGE_KEY)).toBe(true);
    expect(stale(CHIP_KEY)).toBe(true);
    expect(stale(PLAYER_KEY)).toBe(false);
  });

  it("does the same when the game switches or closes", () => {
    const { rerender, stale } = setup({ state: OPEN, scope: "public" });
    rerender({ state: OTHER, scope: "public" });
    expect(stale(PAGE_KEY)).toBe(true);
    const closed = setup({ state: OPEN, scope: "public" });
    closed.rerender({ state: IDLE, scope: "public" });
    expect(closed.stale(PAGE_KEY)).toBe(true);
  });

  it("treats the first poll answer and repeated answers as no transition", () => {
    const { rerender, stale } = setup({ state: undefined, scope: "public" });
    rerender({ state: OPEN, scope: "public" });
    rerender({ state: OPEN, scope: "public" });
    rerender({ state: { ...OPEN }, scope: "public" });
    expect(stale(PAGE_KEY)).toBe(false);
  });

  it("marks the windows stale when the poll comes back after a gap on the same game", () => {
    const at = (minutes: number) =>
      ({
        ...OPEN,
        lastPolledAt: new Date(Date.UTC(2026, 8, 22, 22, 26 + minutes)).toISOString(),
      }) as SteamPlayerState;
    const { rerender, stale } = setup({ state: at(0), scope: "public" });
    rerender({ state: at(2), scope: "public" });
    rerender({ state: at(17), scope: "public" });
    expect(stale(PAGE_KEY)).toBe(false);
    rerender({ state: at(33), scope: "public" });
    expect(stale(PAGE_KEY)).toBe(true);
    expect(stale(CHIP_KEY)).toBe(true);
  });

  it("ignores the game appearing only because the viewer scope flipped", () => {
    const { rerender, stale } = setup({ state: IDLE, scope: "public" });
    rerender({ state: OPEN, scope: "owner" });
    expect(stale(PAGE_KEY)).toBe(false);
    rerender({ state: IDLE, scope: "owner" });
    expect(stale(PAGE_KEY)).toBe(true);
  });
});
