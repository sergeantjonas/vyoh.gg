import { mockLolStaticFetch } from "@/lol/_shared/static/mock-lol-static";
import {
  useChampionAliasById,
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
  { id: -1, alias: "None", name: "None", roles: [] },
  { id: 1, alias: "JarvanIV", name: "Jarvan IV", roles: ["jungler"] },
  { id: 2, alias: "MonkeyKing", name: "Wukong", roles: ["jungler", "fighter"] },
  { id: 3, alias: "Ahri", name: "Ahri", roles: ["mage"] },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mockLolStaticFetch({ champions: CHAMPIONS });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChampions", () => {
  it("derives a Map from the bundled /lol/static champions, filtering out id=-1 placeholders", async () => {
    const { result } = renderHook(() => useChampions(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.size).toBe(3);
    expect(result.current.data?.get("jarvaniv")?.name).toBe("Jarvan IV");
    expect(result.current.data?.has("none")).toBe(false);
  });

  it("propagates an error message on a non-OK bundle response", async () => {
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
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useChampionName(), { wrapper: makeWrapper() });
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

describe("useChampionAliasById", () => {
  it("returns the Riot alias for a champion id (proxy URL segment)", async () => {
    const { result } = renderHook(() => useChampionAliasById(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current(1)).toBe("JarvanIV"));
    expect(result.current(2)).toBe("MonkeyKing");
  });

  it("returns null for an unknown id (caller renders a blank tile)", async () => {
    const { result } = renderHook(() => useChampionAliasById(), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current(1)).toBe("JarvanIV"));
    expect(result.current(99999)).toBeNull();
  });

  it("returns null before champion data loads", () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useChampionAliasById(), {
      wrapper: makeWrapper(),
    });
    expect(result.current(1)).toBeNull();
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
