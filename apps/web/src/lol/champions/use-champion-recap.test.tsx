import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import {
  useChampionRecap,
  useChampionRecapBySlug,
} from "@/lol/champions/use-champion-recap";
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
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
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

describe("useChampionRecap", () => {
  it("does not fetch when account is undefined", () => {
    renderHook(() => useChampionRecap(undefined, "Ahri"), { wrapper: makeWrapper() });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it("requests the per-champion recap URL with the account params encoded", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    const { result } = renderHook(() => useChampionRecap(account, "Ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champions/Ahri/recap"
    );
  });

  it("surfaces 'HTTP <status>' on a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
    const { result } = renderHook(() => useChampionRecap(account, "Ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("HTTP 500");
  });
});

describe("useChampionRecapBySlug", () => {
  it("resolves the account from the slug and queries the recap endpoint", async () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(account);
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    const { result } = renderHook(() => useChampionRecapBySlug("ahri", "Ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      "/champions/Ahri/recap"
    );
  });

  it("does not fetch when the slug does not resolve to an account", () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(undefined);
    renderHook(() => useChampionRecapBySlug("unknown", "Ahri"), {
      wrapper: makeWrapper(),
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });
});
