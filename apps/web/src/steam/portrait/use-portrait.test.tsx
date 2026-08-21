import { seedViewer } from "@/auth/mock-viewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { portraitQueryOptions, useSteamPortrait } from "./use-portrait";

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

describe("portraitQueryOptions", () => {
  // The /steam/portrait loader primes through this factory, so the key it
  // builds and the key the hook reads have to be the same object shape — a
  // loader that warms a different key looks primed and still renders pending.
  it("keys on the same tuple the route loader primes", () => {
    expect(portraitQueryOptions().queryKey).toEqual(["steam", "portrait", "public"]);
  });

  // The owner sees hidden games in their portrait's naming cards, so the two
  // projections cannot share an entry — whichever landed first would answer
  // for both.
  it("keys the owner's projection separately", () => {
    expect(portraitQueryOptions(true).queryKey).toEqual(["steam", "portrait", "owner"]);
  });

  it("stays fresh for 30 minutes", () => {
    expect(portraitQueryOptions().staleTime).toBe(30 * 60 * 1_000);
  });
});

describe("useSteamPortrait", () => {
  it("hits the portrait endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useSteamPortrait(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The viewer query shares the mock, so match on the URL rather than order.
    const requested = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url) === "http://localhost:2010/steam/portrait");
    expect(requested?.[1]).toMatchObject({ credentials: "include" });
  });

  it("surfaces the api message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no shelf" }), { status: 500 })
    );
    const { result } = renderHook(() => useSteamPortrait(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("no shelf");
  });

  it("falls back to HTTP <status> on a non-json body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => useSteamPortrait(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/HTTP 503/);
  });
});
