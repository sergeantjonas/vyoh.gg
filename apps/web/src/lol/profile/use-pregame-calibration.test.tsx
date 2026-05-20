import { HttpError } from "@/lib/http-error";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePregameCalibration } from "./use-pregame-calibration";

const account: LolAccount = {
  slug: "ahri-euw",
  region: "euw1",
  gameName: "Ahri",
  tagLine: "EUW",
};

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

describe("usePregameCalibration", () => {
  it("encodes queueIds as a sorted CSV and forwards account params", async () => {
    const stats = {
      n: 30,
      directionalHits: 18,
      directionalAccuracy: 0.6,
      meanLpForPositive: 8,
      meanLpForNegative: -6,
      meanLpForNeutral: 0,
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(stats), { status: 200 }));
    const { result } = renderHook(() => usePregameCalibration(account, [440, 420]), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stats);
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.pathname).toContain("/lol/summoners/euw1/Ahri/EUW/pregame-calibration");
    expect(url.searchParams.get("queueIds")).toBe("420,440");
  });

  it("is disabled when the account is undefined", () => {
    const fetchMock = vi.mocked(fetch);
    const { result } = renderHook(() => usePregameCalibration(undefined, [420]), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws an HttpError when the server responds non-2xx", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "nope" }), { status: 500 })
    );
    const { result } = renderHook(() => usePregameCalibration(account, [420]), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(HttpError);
  });
});
