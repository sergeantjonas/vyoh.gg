import { useChampionBuildFlow } from "@/lol/champions/use-champion-build-flow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChampionBuildFlow", () => {
  it("does not fetch when account is undefined", () => {
    renderHook(() => useChampionBuildFlow(undefined, "ahri"), {
      wrapper: makeWrapper(),
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it("does not fetch when championKey is empty", () => {
    renderHook(() => useChampionBuildFlow(account, ""), { wrapper: makeWrapper() });
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it("requests the expected URL with the default count=200", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("[]", { status: 200 }));
    const { result } = renderHook(() => useChampionBuildFlow(account, "ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/champions/ahri/build-flow?count=200"
    );
  });

  it("uses the provided count override", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("[]", { status: 200 }));
    const { result } = renderHook(() => useChampionBuildFlow(account, "ahri", 50), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain("count=50");
  });

  it("surfaces the API message from a non-OK JSON body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "champion not found" }), { status: 404 })
    );
    const { result } = renderHook(() => useChampionBuildFlow(account, "ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("champion not found");
  });

  it("falls back to 'HTTP <status>' when the error body is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("oops", { status: 500 }));
    const { result } = renderHook(() => useChampionBuildFlow(account, "ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("HTTP 500");
  });
});
