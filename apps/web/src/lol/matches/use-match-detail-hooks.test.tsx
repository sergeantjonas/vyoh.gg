import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMatchDetail } from "./use-match-detail";
import { useMatchTimeline } from "./use-match-timeline";

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

const cases = [
  {
    name: "useMatchDetail",
    call: (id: string) => useMatchDetail(id),
    url: (id: string) => `http://localhost:2010/lol/matches/${encodeURIComponent(id)}`,
  },
  {
    name: "useMatchTimeline",
    call: (id: string) => useMatchTimeline(id),
    url: (id: string) =>
      `http://localhost:2010/lol/matches/${encodeURIComponent(id)}/timeline`,
  },
];

describe("match-detail hooks", () => {
  it.each(cases)("$name stays disabled while matchId is empty", ({ call }) => {
    renderHook(() => call(""), { wrapper: makeWrapper() });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(cases)(
    "$name fetches the match-id URL and parses the body",
    async ({ call, url }) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      const { result } = renderHook(() => call("EUW1_1"), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(fetch).toHaveBeenCalledWith(url("EUW1_1"));
      expect(result.current.data).toEqual({ ok: true });
    }
  );

  it.each(cases)("$name surfaces the api error message", async ({ call }) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no match" }), { status: 404 })
    );
    const { result } = renderHook(() => call("EUW1_1"), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no match");
  });

  it.each(cases)(
    "$name falls back to HTTP <status> when the body is not json",
    async ({ call }) => {
      vi.mocked(fetch).mockResolvedValue(new Response("nope", { status: 500 }));
      const { result } = renderHook(() => call("EUW1_1"), { wrapper: makeWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toMatch(/HTTP 500/);
    }
  );
});
