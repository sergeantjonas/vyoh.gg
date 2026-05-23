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

  it("maps the bundle abilities to Q/W/E/R identity rows with wiki icon URLs", async () => {
    mockLolStaticFetch({
      champions: [
        {
          id: 103,
          alias: "Ahri",
          name: "Ahri",
          roles: ["mage"],
          modernClasses: ["Mage"],
          modernSubclasses: ["Burst"],
        },
      ],
      championAbilities: {
        103: [
          {
            slot: "Q",
            abilityIndex: 1,
            name: "Orb of Deception",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: null,
          },
          {
            slot: "W",
            abilityIndex: 2,
            name: "Fox-Fire",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: null,
          },
          {
            slot: "E",
            abilityIndex: 3,
            name: "Charm",
            iconWikiName: null,
            descriptionHtml: null,
            descriptionWikitext: null,
          },
          {
            slot: "R",
            abilityIndex: 4,
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
      championId: 103,
      slot: "Q",
      abilityIndex: 1,
      // Icon now resolves through the image proxy keyed by id/slot/idx — the
      // proxy reads the wiki URL server-side, so web call sites no longer
      // hit wiki directly.
      iconUrl: expect.stringMatching(/\/img\/lol\/ability\/103\/Q\/1\/[^/]+\.webp$/),
      name: "Orb of Deception",
    });
    expect(result.current?.[3]?.name).toBe("Spirit Rush");
    expect(result.current?.[3]?.abilityIndex).toBe(4);
    expect(result.current?.[3]?.iconUrl).toContain("/img/lol/ability/103/R/4/");
  });

  it("resolves the champion by Riot alias as well as display name", async () => {
    mockLolStaticFetch({
      champions: [
        {
          id: 62,
          alias: "MonkeyKing",
          name: "Wukong",
          roles: [],
          modernClasses: [],
          modernSubclasses: [],
        },
      ],
      championAbilities: {
        62: [
          {
            slot: "Q",
            abilityIndex: 1,
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
    expect(byAlias.result.current?.[0]?.championId).toBe(62);
    // Proxy URL uses championId (not alias) since the resolver looks up the
    // row by primary key — the display-name handling lives server-side.
    expect(byAlias.result.current?.[0]?.iconUrl).toContain("/img/lol/ability/62/Q/1/");
  });

  it("returns undefined for an unknown champion name", async () => {
    mockLolStaticFetch({
      champions: [
        {
          id: 1,
          alias: "Annie",
          name: "Annie",
          roles: [],
          modernClasses: [],
          modernSubclasses: [],
        },
      ],
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
