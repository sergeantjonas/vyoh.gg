import { mockLolStaticFetch } from "@/lol/_shared/static/mock-lol-static";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePerks } from "./use-perks";
import { useSummonerSpells } from "./use-summoner-spells";

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

describe("usePerks", () => {
  it("derives a Map keyed by id from the bundled /lol/static payload", async () => {
    mockLolStaticFetch({
      patchVersion: "15.1.1",
      perks: [
        {
          id: 8005,
          name: "Press the Attack",
          path: "Precision",
          slot: "Keystone",
          iconWikiName: null,
          descriptionWikitext: null,
          descriptionHtml: null,
          retiredAt: null,
        },
      ],
    });
    const { result } = renderHook(() => usePerks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    const entry = result.current?.get(8005);
    expect(entry?.name).toBe("Press the Attack");
    expect(entry?.iconUrl).toContain("8005");
  });

  it("filters out retired perks (e.g. Phase Rush) so the live UI never surfaces them", async () => {
    mockLolStaticFetch({
      perks: [
        {
          id: 8230,
          name: "Phase Rush",
          path: "Sorcery",
          slot: "Keystone",
          iconWikiName: null,
          descriptionWikitext: null,
          descriptionHtml: null,
          retiredAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    });
    const { result } = renderHook(() => usePerks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    expect(result.current?.has(8230)).toBe(false);
  });

  it("returns undefined while the request is pending", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => usePerks(), { wrapper: makeWrapper() });
    expect(result.current).toBeUndefined();
  });

  it("strips wikitext templates from descriptions for plain-text tooltips", async () => {
    mockLolStaticFetch({
      perks: [
        {
          id: 8005,
          name: "Press the Attack",
          path: "Precision",
          slot: "Keystone",
          iconWikiName: null,
          descriptionWikitext: "Hitting an enemy with {{as|3 basic attacks}} marks them.",
          descriptionHtml: null,
          retiredAt: null,
        },
      ],
    });
    const { result } = renderHook(() => usePerks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    expect(result.current?.get(8005)?.description).toBe(
      "Hitting an enemy with 3 basic attacks marks them."
    );
  });
});

describe("useSummonerSpells", () => {
  it("derives a Map keyed by id from the bundled /lol/static payload", async () => {
    mockLolStaticFetch({
      summonerSpells: [
        {
          id: 4,
          name: "Flash",
          iconWikiName: null,
          descriptionWikitext: null,
          descriptionHtml: null,
          retiredAt: null,
        },
      ],
    });
    const { result } = renderHook(() => useSummonerSpells(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    const entry = result.current?.get(4);
    expect(entry?.name).toBe("Flash");
    expect(entry?.iconUrl).toContain("4");
  });

  it("strips wikitext templates from descriptions for plain-text tooltips", async () => {
    mockLolStaticFetch({
      summonerSpells: [
        {
          id: 4,
          name: "Flash",
          iconWikiName: null,
          descriptionWikitext: "Teleports your champion {{as|400 units}}.",
          descriptionHtml: null,
          retiredAt: null,
        },
      ],
    });
    const { result } = renderHook(() => useSummonerSpells(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    expect(result.current?.get(4)?.description).toBe(
      "Teleports your champion 400 units."
    );
  });

  it("filters out retired summoner spells", async () => {
    mockLolStaticFetch({
      summonerSpells: [
        {
          id: 31,
          name: "Old Spell",
          iconWikiName: null,
          descriptionWikitext: null,
          descriptionHtml: null,
          retiredAt: "2026-05-21T00:00:00.000Z",
        },
      ],
    });
    const { result } = renderHook(() => useSummonerSpells(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    expect(result.current?.has(31)).toBe(false);
  });
});
