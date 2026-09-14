import { seedViewer } from "@/auth/mock-viewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionsQueryOptions, useSteamSessions } from "./use-sessions";

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client);
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

describe("sessionsQueryOptions", () => {
  // The scope goes last so a prefix invalidation on ["steam", "sessions"]
  // still catches both projections.
  it("keys on window then viewer scope", () => {
    expect(sessionsQueryOptions().queryKey).toEqual(["steam", "sessions", 12, "public"]);
    expect(sessionsQueryOptions(true, 4).queryKey).toEqual([
      "steam",
      "sessions",
      4,
      "owner",
    ]);
  });
});

describe("useSteamSessions", () => {
  it("asks for the window with the viewer's cookie", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ sessions: [] }), { status: 200 })
    );
    const { result } = renderHook(() => useSteamSessions(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const requested = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes("/steam/sessions"));
    expect(String(requested?.[0])).toBe("http://localhost:2010/steam/sessions?weeks=12");
    expect(requested?.[1]).toMatchObject({ credentials: "include" });
  });

  it("surfaces the api message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "no log" }), { status: 500 })
    );
    const { result } = renderHook(() => useSteamSessions(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("no log");
  });
});
