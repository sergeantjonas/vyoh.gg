import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChampionMastery } from "./use-champion-mastery";

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

describe("useChampionMastery", () => {
  it("does not fetch when no account resolves from the slug", () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(undefined);
    renderHook(() => useChampionMastery("ahri", "ahri"), { wrapper: makeWrapper() });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it("requests the per-champion mastery URL without a session cookie", async () => {
    vi.mocked(useAccountFromSlug).mockReturnValue(account);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ mastery: null }), { status: 200 })
    );
    const { result } = renderHook(() => useChampionMastery("ahri", "monkeyking"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champions/monkeyking/mastery"
    );
    expect(init).toBeUndefined();
  });
});
