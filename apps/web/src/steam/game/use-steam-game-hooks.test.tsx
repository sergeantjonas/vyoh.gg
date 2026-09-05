import { seedViewer } from "@/auth/mock-viewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameAchievements } from "./use-game-achievements";
import { useGameDescription } from "./use-game-description";
import { useGameScreenshots } from "./use-game-screenshots";
import { useGameUnlockTimeline } from "./use-game-unlock-timeline";
import { useSteamGame } from "./use-steam-game";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client);
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type SteamHookCase = {
  name: string;
  call: () => {
    isSuccess: boolean;
    isError: boolean;
    data?: unknown;
    error?: Error | null;
  };
  url: string;
  enabled?: boolean;
};

const cases: SteamHookCase[] = [
  {
    name: "useGameUnlockTimeline",
    call: () => useGameUnlockTimeline(42),
    url: "http://localhost:2010/steam/game/42/unlock-timeline",
  },
  {
    name: "useGameAchievements",
    call: () => useGameAchievements(42),
    url: "http://localhost:2010/steam/game/42/achievements",
  },
  {
    name: "useGameScreenshots",
    call: () => useGameScreenshots(42),
    url: "http://localhost:2010/steam/game/42/screenshots",
  },
  {
    name: "useGameDescription",
    call: () => useGameDescription(42),
    url: "http://localhost:2010/steam/game/42/description",
  },
  {
    name: "useSteamGame",
    call: () => useSteamGame(42),
    url: "http://localhost:2010/steam/game/42",
  },
];

describe.each(cases)("$name", ({ call, url }) => {
  // Not `calls[0]` — every one of these routes is viewer-aware, so the viewer
  // query fires against the same mock alongside the request under test.
  it("requests the expected URL with the session cookie", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(call, { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const requested = vi
      .mocked(fetch)
      .mock.calls.find(([candidate]) => String(candidate) === url);
    expect(requested?.[1]).toMatchObject({ credentials: "include" });
  });

  it("surfaces the API message from a non-OK JSON body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "rate limited" }), { status: 429 })
    );
    const { result } = renderHook(call, { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("rate limited");
  });

  it("falls back to 'HTTP <status>' when the error body is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("oops", { status: 500 }));
    const { result } = renderHook(call, { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("HTTP 500");
  });
});
