import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { SeriousQueuesProvider } from "@/lol/_shared/serious-queues/serious-queues";
import { useChampionExtras } from "@/lol/champions/use-champion-extras";
import { useChampionLanePhase } from "@/lol/champions/use-champion-lane-phase";
import { useChampionRuneDiversity } from "@/lol/champions/use-champion-rune-diversity";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: vi.fn(),
}));

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <SeriousQueuesProvider>{children}</SeriousQueuesProvider>
    </QueryClientProvider>
  );
}

const account: LolAccount = {
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
  slug: "ahri",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(useAccountFromSlug).mockReset();
});

describe("useChampionExtras", () => {
  it("does not fetch when no account resolves from the slug", () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(undefined);
    renderHook(() => useChampionExtras("ahri", "ahri"), { wrapper: makeWrapper() });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it("requests the per-champion stats URL when account is resolvable", async () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(account);
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    const { result } = renderHook(() => useChampionExtras("ahri", "ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champions/ahri/stats?queues=420%2C440"
    );
  });

  it("surfaces 'HTTP <status>' on a non-OK response", async () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(account);
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(() => useChampionExtras("ahri", "ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("HTTP 500");
  });
});

// These two take the resolved account directly rather than a slug, so they
// don't go through useAccountFromSlug the way useChampionExtras above does.
// Same shape as each other, so they share a table.
type ChampionHookCase = {
  name: string;
  call: (
    acc: LolAccount | undefined,
    championKey: string
  ) => {
    isSuccess: boolean;
    isError: boolean;
    data?: unknown;
    error?: Error | null;
  };
  url: string;
};

const championCases: ChampionHookCase[] = [
  {
    name: "useChampionLanePhase (default count=200)",
    call: (a, key) => useChampionLanePhase(a, key),
    url: "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champions/ahri/lane-phase?count=200",
  },
  {
    name: "useChampionRuneDiversity (default count=200)",
    call: (a, key) => useChampionRuneDiversity(a, key),
    url: "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champions/ahri/rune-diversity?count=200",
  },
];

describe("account-scoped champion hooks", () => {
  // The enabled guard is `account !== undefined && championKey.length > 0`, so
  // both halves need their own no-fetch case.
  it.each(championCases)("$name does not fetch without an account", ({ call }) => {
    renderHook(() => call(undefined, "ahri"), { wrapper: makeWrapper() });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it.each(championCases)("$name does not fetch on an empty championKey", ({ call }) => {
    renderHook(() => call(account, ""), { wrapper: makeWrapper() });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it.each(championCases)(
    "$name fetches $url and returns the body",
    async ({ call, url }) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      const { result } = renderHook(() => call(account, "ahri"), {
        wrapper: makeWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(url);
      expect(result.current.data).toEqual({ ok: true });
    }
  );

  it.each(championCases)("$name surfaces the api message", async ({ call }) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no soup" }), { status: 500 })
    );
    const { result } = renderHook(() => call(account, "ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("no soup");
  });

  it.each(championCases)(
    "$name falls back to HTTP <status> on a non-json body",
    async ({ call }) => {
      vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
      const { result } = renderHook(() => call(account, "ahri"), {
        wrapper: makeWrapper(),
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as Error).message).toMatch(/HTTP 503/);
    }
  );
});
