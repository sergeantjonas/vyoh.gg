import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useItems } from "./use-items";

vi.mock("@/lol/_shared/patch/use-ddragon-version", () => ({
  useDDragonVersion: () => "15.1.1",
}));

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

describe("useItems", () => {
  it("fetches the items json and returns a Map keyed by item id", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 3074,
            name: "Ravenous Hydra",
            description: "Active",
            priceTotal: 3300,
            iconPath: "/items/3074.png",
            from: [3077, 1058],
            categories: ["Damage"],
          },
        ]),
        { status: 200 }
      )
    );
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const map = result.current.data;
    expect(map?.get(3074)?.name).toBe("Ravenous Hydra");
    expect(map?.get(3074)?.from).toEqual([3077, 1058]);
    expect(map?.get(3074)?.categories).toEqual(["Damage"]);
  });

  it("defaults missing `from` and `categories` to empty arrays", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: 1054, name: "Doran's Shield", iconPath: "/items/1054.png" },
        ]),
        { status: 200 }
      )
    );
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.get(1054)?.from).toEqual([]);
    expect(result.current.data?.get(1054)?.categories).toEqual([]);
  });

  it("surfaces an HTTP error when the items endpoint fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const { result } = renderHook(() => useItems(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/HTTP 500/);
  });
});
