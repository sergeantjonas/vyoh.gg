import { mockLolStaticFetch } from "@/lol/_shared/static/mock-lol-static";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useItems } from "./use-items";

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

describe("useItems", () => {
  it("derives a Map keyed by item id from the bundled /lol/static payload", async () => {
    mockLolStaticFetch({
      patchVersion: "15.1.1",
      items: [
        {
          id: 3074,
          name: "Ravenous Hydra",
          tier: 3,
          itemType: [],
          priceTotal: 3300,
          recipe: ["3077", "1058"],
          categories: ["Damage"],
          stats: {},
          descriptionWikitext: null,
          descriptionHtml: "Active",
          iconWikiName: null,
        },
      ],
    });
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const map = result.current.data;
    expect(map?.get(3074)?.name).toBe("Ravenous Hydra");
    expect(map?.get(3074)?.from).toEqual([3077, 1058]);
    expect(map?.get(3074)?.categories).toEqual(["Damage"]);
    expect(map?.get(3074)?.description).toBe("Active");
  });

  it("populates descriptionRich with sanitized wiki HTML when present", async () => {
    mockLolStaticFetch({
      patchVersion: "15.1.1",
      items: [
        {
          id: 3157,
          name: "Zhonya's Hourglass",
          tier: 3,
          itemType: [],
          priceTotal: 3250,
          recipe: [],
          categories: [],
          stats: {},
          descriptionWikitext: null,
          descriptionHtml:
            'Deals <span class="callout"><img src="/en-us/images/2/2a/Magic_damage.png" alt="Magic"> 200</span> magic damage.',
          iconWikiName: null,
        },
      ],
    });
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const rich = result.current.data?.get(3157)?.descriptionRich;
    expect(rich).toContain('<span class="callout">');
    expect(rich).toContain(
      'src="http://localhost:2010/img/lol/wiki-file/Magic_damage.png.webp"'
    );
  });

  it("leaves descriptionRich undefined when descriptionHtml is null", async () => {
    mockLolStaticFetch({
      items: [
        {
          id: 1054,
          name: "Doran's Shield",
          tier: 1,
          itemType: [],
          priceTotal: null,
          recipe: [],
          categories: [],
          stats: {},
          descriptionWikitext: "+80 health.",
          descriptionHtml: null,
          iconWikiName: null,
        },
      ],
    });
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.get(1054)?.descriptionRich).toBeUndefined();
    expect(result.current.data?.get(1054)?.description).toBe("+80 health.");
  });

  it("defaults missing `from` and `categories` to empty arrays", async () => {
    mockLolStaticFetch({
      items: [
        {
          id: 1054,
          name: "Doran's Shield",
          tier: 1,
          itemType: [],
          priceTotal: null,
          recipe: [],
          categories: [],
          stats: {},
          descriptionWikitext: null,
          descriptionHtml: null,
          iconWikiName: null,
        },
      ],
    });
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.get(1054)?.from).toEqual([]);
    expect(result.current.data?.get(1054)?.categories).toEqual([]);
  });

  it("surfaces an HTTP error when the bundle endpoint fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });
});
