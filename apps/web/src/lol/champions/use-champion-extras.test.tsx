import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionExtras } from "@/lol/champions/use-champion-extras";
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
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champions/ahri/stats"
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
