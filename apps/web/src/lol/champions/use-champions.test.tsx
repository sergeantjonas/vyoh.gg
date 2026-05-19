import {
  useChampionAliasFromName,
  useChampionInfo,
  useChampionName,
  useChampions,
} from "@/lol/champions/use-champions";
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

const CHAMPIONS = [
  { id: -1, alias: "None", name: "None", description: "", roles: [] },
  {
    id: 1,
    alias: "JarvanIV",
    name: "Jarvan IV",
    description: "exemplar of demacia",
    roles: ["jungler"],
  },
  {
    id: 2,
    alias: "MonkeyKing",
    name: "Wukong",
    description: "the monkey king",
    roles: ["jungler", "fighter"],
  },
  {
    id: 3,
    alias: "Ahri",
    name: "Ahri",
    description: "the nine-tailed fox",
    roles: ["mage"],
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(CHAMPIONS), { status: 200 }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChampions", () => {
  it("fetches and parses the champion-summary JSON, filtering out id=-1 placeholders", async () => {
    const { result } = renderHook(() => useChampions(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.size).toBe(3);
    expect(result.current.data?.get("jarvaniv")?.name).toBe("Jarvan IV");
    expect(result.current.data?.has("none")).toBe(false);
  });

  it("propagates an error message on a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(() => useChampions(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toContain("HTTP 500");
  });
});

describe("useChampionName", () => {
  it("resolves a Riot alias to its display name once data is loaded", async () => {
    const { result } = renderHook(() => useChampionName(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current("JarvanIV")).toBe("Jarvan IV"));
    expect(result.current("MonkeyKing")).toBe("Wukong");
  });

  it("falls back to a normalized alias while data is still loading", () => {
    // Mock fetch with an unresolved promise so the query stays pending
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useChampionName(), { wrapper: makeWrapper() });
    // normalizeChampionAlias passes through unmatched aliases as-is
    expect(result.current("JarvanIV")).toBe("JarvanIV");
  });
});

describe("useChampionInfo", () => {
  it("returns full champion info for a known alias (case-insensitive)", async () => {
    const { result } = renderHook(() => useChampionInfo("AHRI"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current?.name).toBe("Ahri"));
    expect(result.current?.roles).toEqual(["mage"]);
  });

  it("returns undefined for an unknown alias", async () => {
    const { result } = renderHook(() => useChampionInfo("Unknown"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current).toBeUndefined());
  });
});

describe("useChampionAliasFromName", () => {
  it("reverse-maps a display name back to the Riot alias", async () => {
    const { result } = renderHook(() => useChampionAliasFromName(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current("Wukong")).toBe("monkeyking"));
    expect(result.current("Jarvan IV")).toBe("jarvaniv");
  });

  it("falls back to the input when champion data has not loaded yet", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useChampionAliasFromName(), {
      wrapper: makeWrapper(),
    });
    expect(result.current("Wukong")).toBe("Wukong");
  });

  it("falls back to the input for an unknown display name", async () => {
    const { result } = renderHook(() => useChampionAliasFromName(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current("Ahri")).toBe("ahri"));
    expect(result.current("NotAChampion")).toBe("NotAChampion");
  });
});
