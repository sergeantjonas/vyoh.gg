import {
  useWishlistHeroMeta,
  wishlistHeroMetaQueryOptions,
} from "@/steam/wishlist/upcoming/use-wishlist-hero-meta";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// The factory is exported separately so callers can prefetch; assert its key
// shape without React, since a drifting key silently breaks that prefetch.
describe("wishlistHeroMetaQueryOptions", () => {
  it("builds a stable appid-scoped query key", () => {
    expect(wishlistHeroMetaQueryOptions(42).queryKey).toEqual([
      "steam",
      "wishlist",
      42,
      "hero-meta",
    ]);
  });

  it("does not retry, so a 404 settles immediately", () => {
    expect(wishlistHeroMetaQueryOptions(42).retry).toBe(false);
  });
});

describe("useWishlistHeroMeta", () => {
  it("fetches the hero-meta endpoint and returns the body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useWishlistHeroMeta(42), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/steam/wishlist/42/hero-meta"
    );
    expect(result.current.data).toEqual({ ok: true });
  });

  // A 404 means the store page was unresolvable — the hero renders without
  // enriched chrome rather than throwing to a boundary.
  it("surfaces an unresolvable store page as isError, not a throw", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 404 }));
    const { result } = renderHook(() => useWishlistHeroMeta(42), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/HTTP 404/);
  });

  it("surfaces the api message when one is present", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no meta" }), { status: 500 })
    );
    const { result } = renderHook(() => useWishlistHeroMeta(42), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("no meta");
  });
});
