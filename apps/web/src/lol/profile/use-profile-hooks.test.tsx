import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChampionPairs } from "./use-champion-pairs";
import { useChronotype } from "./use-chronotype";
import { useDuos } from "./use-duos";
import { useProfileRank } from "./use-profile-rank";
import { useRankHistory } from "./use-rank-history";

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

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

type AccountHookCase = {
  name: string;
  call: (acc: LolAccount | undefined) => {
    isSuccess: boolean;
    isError: boolean;
    data?: unknown;
    error?: Error | null;
  };
  url: string;
};

const cases: AccountHookCase[] = [
  {
    name: "useChronotype (default count=500)",
    call: (a) => useChronotype(a),
    url: "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/chronotype?count=500",
  },
  {
    name: "useDuos (default count=100)",
    call: (a) => useDuos(a),
    url: "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/duos?count=100",
  },
  {
    name: "useChampionPairs (default count=200)",
    call: (a) => useChampionPairs(a),
    url: "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champion-pairs?count=200",
  },
  {
    name: "useProfileRank",
    call: (a) => useProfileRank(a),
    url: "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/rank",
  },
  {
    name: "useRankHistory (30d range)",
    call: (a) => useRankHistory(a, "30d"),
    url: "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/rank/history?days=30",
  },
];

describe("per-account profile hooks", () => {
  it.each(cases)("$name does not fetch when account is undefined", ({ call }) => {
    renderHook(() => call(undefined), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(cases)("$name fetches $url and returns the body", async ({ call, url }) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => call(account), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(url);
    expect(result.current.data).toEqual({ ok: true });
  });

  it.each(cases)("$name surfaces the api message", async ({ call }) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no soup" }), { status: 500 })
    );
    const { result } = renderHook(() => call(account), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no soup");
  });

  it.each(cases)(
    "$name falls back to HTTP <status> on non-json body",
    async ({ call }) => {
      vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
      const { result } = renderHook(() => call(account), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toMatch(/HTTP 503/);
    }
  );
});

describe("useChronotype custom count", () => {
  it("includes a custom count in the URL", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useChronotype(account, 42), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/chronotype?count=42"
    );
  });
});

describe("useRankHistory range variants", () => {
  it("90d range adds days=90 to the URL", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useRankHistory(account, "90d"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/rank/history?days=90"
    );
  });

  it("season range omits the days query param", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useRankHistory(account, "season"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/rank/history"
    );
  });
});
