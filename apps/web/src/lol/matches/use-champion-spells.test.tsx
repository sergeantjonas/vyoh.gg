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
  it("returns undefined until both summary and spells load", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useChampionSpells("Ahri"), {
      wrapper: makeWrapper(),
    });
    expect(result.current).toBeUndefined();
  });

  it("resolves the alias via the champion-summary map and fetches that champion's spells", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("champion-summary.json")) {
        return Promise.resolve(
          new Response(JSON.stringify([{ id: 103, name: "Ahri", alias: "Ahri" }]), {
            status: 200,
          })
        );
      }
      if (url.includes("/champions/103.json")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              spells: [
                {
                  abilityIconPath:
                    "/lol-game-data/assets/ASSETS/Characters/Ahri/HUD/Icons2D/Ahri_Q.png",
                  name: "Orb of Deception",
                  description: "<i>Deals</i> magic damage.",
                },
              ],
            }),
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected url ${url}`));
    });

    const { result } = renderHook(() => useChampionSpells("Ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current).not.toBeUndefined());
    expect(result.current).toEqual([
      {
        iconUrl: expect.stringContaining("ahri/hud/icons2d/ahri_q.png"),
        name: "Orb of Deception",
        description: "Deals magic damage.",
      },
    ]);
  });

  it("does not call the per-champion endpoint when the alias is unknown", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const { result } = renderHook(() => useChampionSpells("Unknown"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0);
    });
    expect(result.current).toBeUndefined();
    const calls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => c.includes("/champions/"))).toBe(false);
  });
});
