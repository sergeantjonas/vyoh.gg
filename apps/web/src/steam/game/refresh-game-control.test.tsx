import { seedViewer } from "@/auth/mock-viewer";
import { OWNER_ONLY_COPY } from "@/auth/owner-action";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { SteamGameRefreshLegs, SteamGameRefreshResult } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RefreshGameControl,
  RefreshGameResult,
  describeLegs,
} from "./refresh-game-control";
import { refreshedQueryKeys, useRefreshSteamGame } from "./use-refresh-steam-game";

const toast = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/lib/toast", () => toast);

const APPID = 1034140;
const BUTTON = { name: "Refresh this game from Steam" };
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function legs(overrides: Partial<SteamGameRefreshLegs> = {}): SteamGameRefreshLegs {
  return {
    schema: { achievementCount: 52, failed: false },
    unlocks: { newUnlocks: 2, statsPrivate: false, failed: false },
    rarity: { rowsWritten: 52, failed: false },
    enrichment: { written: true, failed: false },
    playtime: { beforeMinutes: 120, afterMinutes: 135, failed: false },
    ...overrides,
  };
}

function ran(overrides: Partial<SteamGameRefreshLegs> = {}): SteamGameRefreshResult {
  return {
    ran: true,
    appid: APPID,
    startedAt: "2026-09-05T16:00:00.000Z",
    durationMs: 2400,
    legs: legs(overrides),
  };
}

// The page owns the mutation and renders the two halves in different places;
// this stands in for that page.
function Harness() {
  const refresh = useRefreshSteamGame(APPID);
  return (
    <>
      <RefreshGameControl refresh={refresh} className="ml-auto" />
      {refresh.data?.ran && <RefreshGameResult legs={refresh.data.legs} />}
    </>
  );
}

function renderControl(isOwner: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  seedViewer(client, isOwner);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <Harness />
      </Tooltip.Provider>
    </QueryClientProvider>
  );
  return { ...view, invalidate };
}

function respondWith(body: SteamGameRefreshResult, status = 200) {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  toast.toastInfo.mockReset();
  toast.toastError.mockReset();
});

describe("RefreshGameControl", () => {
  it("renders locked with the owner-only hint for a visitor", async () => {
    renderControl(false);
    const button = screen.getByRole("button", BUTTON);
    expect(button).toHaveProperty("disabled", true);
    await userEvent.hover(button.parentElement as HTMLElement);
    await waitFor(() =>
      expect(screen.getAllByText(OWNER_ONLY_COPY).length).toBeGreaterThan(0)
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts with credentials, invalidates every owner-scoped read and reads the legs back", async () => {
    respondWith(ran());
    const { invalidate } = renderControl(true);

    await userEvent.click(screen.getByRole("button", BUTTON));

    const result = await screen.findByRole("status", { name: "Refresh result" });
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:2010/steam/game/${APPID}/refresh`,
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(result.textContent).toBe(
      "52 achievements in schema · 2 new unlocks · rarity for 52 achievements · store data refreshed · playtime up 15 min (library snapshot)"
    );
    const keys = refreshedQueryKeys(APPID);
    expect(keys).toHaveLength(8);
    for (const queryKey of keys) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    expect(invalidate).toHaveBeenCalledTimes(keys.length);
  });

  it("is disabled while a run is in flight", async () => {
    let resolve!: (res: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });
    vi.mocked(fetch).mockReturnValue(pending);
    renderControl(true);

    await userEvent.click(screen.getByRole("button", BUTTON));
    await waitFor(() =>
      expect(screen.getByRole("button", BUTTON)).toHaveProperty("disabled", true)
    );

    resolve(new Response(JSON.stringify(ran()), { status: 200 }));
    await waitFor(() =>
      expect(screen.getByRole("button", BUTTON)).toHaveProperty("disabled", false)
    );
  });

  it("reports a refused run as a toast and invalidates nothing", async () => {
    respondWith({ ran: false, reason: "already running" });
    const { invalidate } = renderControl(true);

    await userEvent.click(screen.getByRole("button", BUTTON));

    await waitFor(() => expect(toast.toastInfo).toHaveBeenCalledOnce());
    expect(screen.queryByRole("status")).toBeNull();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("surfaces a failed request as a toast", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    renderControl(true);

    await userEvent.click(screen.getByRole("button", BUTTON));

    await waitFor(() =>
      expect(toast.toastError).toHaveBeenCalledWith("Refresh failed: HTTP 500")
    );
  });

  it("has no axe violations in either state", async () => {
    for (const isOwner of [false, true]) {
      const { container, unmount } = renderControl(isOwner);
      expect((await axe(container)).violations).toEqual([]);
      unmount();
    }
  });
});

describe("describeLegs", () => {
  it("names Steam's per-app privacy refusal instead of a zero", () => {
    const lines = describeLegs(
      legs({ unlocks: { newUnlocks: 0, statsPrivate: true, failed: false } })
    );
    expect(lines[1]).toBe("unlock stats private on Steam");
  });

  it("states each failed leg, and an unchanged snapshot as unchanged", () => {
    expect(
      describeLegs(
        legs({
          schema: { achievementCount: null, failed: true },
          unlocks: { newUnlocks: 1, statsPrivate: false, failed: false },
          rarity: { rowsWritten: 0, failed: true },
          enrichment: { written: false, failed: true },
          playtime: { beforeMinutes: 120, afterMinutes: 120, failed: false },
        })
      )
    ).toEqual([
      "schema fetch failed",
      "1 new unlock",
      "rarity fetch failed",
      "store data failed",
      "playtime unchanged (library snapshot)",
    ]);
  });

  // A just-bought game has no earlier snapshot: its whole total is not a delta.
  it("quotes the total rather than a delta when the game had no snapshot before", () => {
    const [, , , , playtime] = describeLegs(
      legs({ playtime: { beforeMinutes: null, afterMinutes: 90, failed: false } })
    );
    expect(playtime).toBe("playtime 1.5 hrs (library snapshot)");
  });
});
