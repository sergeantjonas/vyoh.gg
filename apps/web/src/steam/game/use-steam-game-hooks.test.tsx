import { useGameMedia } from "@/steam/library/use-game-media";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameAchievements } from "./use-game-achievements";
import { useGameUnlockTimeline } from "./use-game-unlock-timeline";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    name: "useGameMedia (enabled=true)",
    call: () => useGameMedia(42, true),
    url: "http://localhost:2010/steam/game/42/media",
  },
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
];

describe.each(cases)("$name", ({ call, url }) => {
  it("requests the expected URL on the first fetch", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(call, { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(url);
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

describe("useGameMedia (enabled=false)", () => {
  it("does not fetch when enabled is false", () => {
    renderHook(() => useGameMedia(42, false), { wrapper: makeWrapper() });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });
});
