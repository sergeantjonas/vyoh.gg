import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAbilityDescription } from "./use-ability-description";

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

describe("useAbilityDescription", () => {
  it("fetches the lazy ability endpoint with the encoded path segments", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          championId: 103,
          slot: "Q",
          abilityIndex: 1,
          name: "Orb of Deception",
          iconWikiName: null,
          descriptionHtml: "<i>Deals</i> magic damage.",
          descriptionWikitext: null,
        }),
        { status: 200 }
      )
    );

    const { result } = renderHook(() => useAbilityDescription(103, "Q", 1), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.data).not.toBeUndefined());
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/lol/static/ability/103/Q/1"
    );
    expect(result.current.data?.name).toBe("Orb of Deception");
  });

  it("does not fetch when disabled", () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    renderHook(() => useAbilityDescription(0, "", 0, { enabled: false }), {
      wrapper: makeWrapper(),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("surfaces an error when the endpoint returns non-OK", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 404 }));
    const { result } = renderHook(() => useAbilityDescription(999, "Q", 0), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
