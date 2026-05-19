import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePerks } from "./use-perks";
import { useSummonerSpells } from "./use-summoner-spells";

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "15.1.1",
}));

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
  it("fetches the perks json and returns a Map keyed by id", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([{ id: 8005, iconPath: "/path.png", name: "Press the Attack" }]),
        { status: 200 }
      )
    );
    const { result } = renderHook(() => usePerks(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    const entry = result.current?.get(8005);
    expect(entry?.name).toBe("Press the Attack");
    expect(entry?.iconUrl).toContain("8005");
  });

  it("returns undefined while the request is pending", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => usePerks(), { wrapper: makeWrapper() });
    expect(result.current).toBeUndefined();
  });
});

describe("useSummonerSpells", () => {
  it("fetches the summoner-spells json and returns a Map keyed by id", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ id: 4, iconPath: "/path.png", name: "Flash" }]), {
        status: 200,
      })
    );
    const { result } = renderHook(() => useSummonerSpells(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBeInstanceOf(Map));
    const entry = result.current?.get(4);
    expect(entry?.name).toBe("Flash");
    expect(entry?.iconUrl).toContain("4");
  });
});
