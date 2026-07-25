import { useMatchBaseline } from "@/lol/matches/use-match-baseline";
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

describe("useMatchBaseline", () => {
  // The enabled guard is a three-way AND, so each arm gets its own case.
  it("does not fetch without an account", () => {
    renderHook(() => useMatchBaseline(undefined, "Ahri", "MIDDLE"), {
      wrapper: makeWrapper(),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not fetch without a champion alias", () => {
    renderHook(() => useMatchBaseline(account, undefined, "MIDDLE"), {
      wrapper: makeWrapper(),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not fetch without a role", () => {
    renderHook(() => useMatchBaseline(account, "Ahri", undefined), {
      wrapper: makeWrapper(),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requests the baselines URL once all three are present", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useMatchBaseline(account, "Ahri", "MIDDLE"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/baselines/Ahri/MIDDLE"
    );
  });

  // Every path segment is encoded — a champion alias with a space would
  // otherwise produce a malformed URL.
  it("encodes alias and role path segments", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(
      () => useMatchBaseline(account, "Dr. Mundo", "TOP/JUNGLE"),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri/baselines/Dr.%20Mundo/TOP%2FJUNGLE"
    );
  });

  it("surfaces the api message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no baseline" }), { status: 500 })
    );
    const { result } = renderHook(() => useMatchBaseline(account, "Ahri", "MIDDLE"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("no baseline");
  });

  it("falls back to HTTP <status> on a non-json body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => useMatchBaseline(account, "Ahri", "MIDDLE"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/HTTP 503/);
  });
});
