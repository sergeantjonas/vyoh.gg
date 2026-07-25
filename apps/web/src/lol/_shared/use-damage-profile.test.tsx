import { useDamageProfile } from "@/lol/_shared/use-damage-profile";
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

const BASE = "http://localhost:2010/lol/summoners/euw1/Vyoh/Ahri";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// One endpoint, two scopes — the championKey argument is what switches the
// path, so both branches need pinning.
describe("useDamageProfile", () => {
  it("does not fetch without an account", () => {
    renderHook(() => useDamageProfile(undefined), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hits the account-scoped path when no championKey is given", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useDamageProfile(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      `${BASE}/damage-profile?count=100`
    );
  });

  it("hits the champion-scoped path when a championKey is given", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useDamageProfile(account, "ahri"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      `${BASE}/champions/ahri/damage-profile?count=100`
    );
  });

  it("encodes a championKey that needs escaping", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { result } = renderHook(() => useDamageProfile(account, "Dr. Mundo"), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toBe(
      `${BASE}/champions/Dr.%20Mundo/damage-profile?count=100`
    );
  });

  it("surfaces the api message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no soup" }), { status: 500 })
    );
    const { result } = renderHook(() => useDamageProfile(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe("no soup");
  });

  it("falls back to HTTP <status> on a non-json body", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 503 }));
    const { result } = renderHook(() => useDamageProfile(account), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/HTTP 503/);
  });
});
