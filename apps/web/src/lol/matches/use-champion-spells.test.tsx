import { mockLolStaticFetch } from "@/lol/_shared/static/mock-lol-static";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChampionSpells } from "./use-champion-spells";

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

describe("useChampionSpells", () => {
  it("returns undefined until the bundle resolves", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useChampionSpells("Ahri"), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toBeUndefined();
  });

  it("maps the bundle abilities to Q/W/E/R rows with wiki icon URLs", async () => {
    mockLolStaticFetch({
      champions: [{ id: 103, alias: "Ahri", name: "Ahri", roles: ["mage"] }],
      championAbilities: {
        103: [
          {
            slot: "Q",
            abilityIndex: 0,
            name: "Orb of Deception",
            iconWikiName: null,
            descriptionHtml: "<i>Deals</i> magic damage.",
            descriptionWikitext: null,
          },
          {
            slot: "W",
            abilityIndex: 0,
            name: "Fox-Fire",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: null,
          },
          {
            slot: "E",
            abilityIndex: 0,
            name: "Charm",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: null,
          },
          {
            slot: "R",
            abilityIndex: 0,
            name: "Spirit Rush",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: null,
          },
        ],
      },
    });

    const { result } = renderHook(() => useChampionSpells("Ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current).not.toBeUndefined());
    expect(result.current?.length).toBe(4);
    expect(result.current?.[0]).toEqual({
      iconUrl: expect.stringContaining("Ahri_Orb_of_Deception.png"),
      name: "Orb of Deception",
      description: "<i>Deals</i> magic damage.",
    });
    expect(result.current?.[3]?.name).toBe("Spirit Rush");
  });

  it("falls back to descriptionWikitext when descriptionHtml is null", async () => {
    mockLolStaticFetch({
      champions: [{ id: 1, alias: "Annie", name: "Annie", roles: [] }],
      championAbilities: {
        1: [
          {
            slot: "Q",
            abilityIndex: 0,
            name: "Disintegrate",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: "{{as|Deals magic damage.}}",
          },
        ],
      },
    });
    const { result } = renderHook(() => useChampionSpells("Annie"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current).not.toBeUndefined());
    expect(result.current?.[0]?.description).toBe("{{as|Deals magic damage.}}");
  });

  it("resolves the champion by Riot alias as well as display name", async () => {
    mockLolStaticFetch({
      champions: [{ id: 62, alias: "MonkeyKing", name: "Wukong", roles: [] }],
      championAbilities: {
        62: [
          {
            slot: "Q",
            abilityIndex: 0,
            name: "Crushing Blow",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: null,
          },
        ],
      },
    });
    const byAlias = renderHook(() => useChampionSpells("MonkeyKing"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(byAlias.result.current).not.toBeUndefined());
    expect(byAlias.result.current?.[0]?.name).toBe("Crushing Blow");
    // Wiki URL uses the canonical display name, not the Riot alias.
    expect(byAlias.result.current?.[0]?.iconUrl).toContain("Wukong_");
  });

  it("returns undefined for an unknown champion name", async () => {
    mockLolStaticFetch({
      champions: [{ id: 1, alias: "Annie", name: "Annie", roles: [] }],
      championAbilities: {},
    });
    const { result } = renderHook(() => useChampionSpells("DoesNotExist"), {
      wrapper: makeWrapper(),
    });
    // Bundle resolves but the lookup misses, so the final value is undefined.
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0);
    });
    expect(result.current).toBeUndefined();
  });
});
