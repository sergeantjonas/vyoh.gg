import { useMe } from "@/identity/use-me";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type {
  LolAccount,
  Me,
  StatusSnapshot,
  SyncTick,
  SyncTickAccountResult,
} from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusPage } from "./status-page";
import {
  useSetSyncEnabled,
  useStatus,
  useStatusStream,
  useSyncAccount,
  useSyncNow,
} from "./use-status";

vi.mock("./use-status", () => ({
  useStatus: vi.fn(),
  useStatusStream: vi.fn(),
  useSyncNow: vi.fn(),
  useSetSyncEnabled: vi.fn(),
  useSyncAccount: vi.fn(),
}));

vi.mock("@/identity/use-me", () => ({ useMe: vi.fn() }));

vi.mock("@/lib/toast", () => ({
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

function renderWithTooltip(ui: ReactNode) {
  return render(<TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>);
}

const account: LolAccount = {
  slug: "ahri",
  region: "euw1",
  gameName: "Vyoh",
  tagLine: "Ahri",
};

const accountResult: SyncTickAccountResult = {
  slug: "ahri",
  label: "Ahri",
  head: { idCount: 10, backfilled: 2 },
  historical: { idCount: 5, backfilled: 1, done: false, skipped: false },
};

const errorAccountResult: SyncTickAccountResult = {
  slug: "ghost",
  label: "Ghost",
  head: { error: "boom" },
  historical: { error: "kapow" },
};

const skippedAccountResult: SyncTickAccountResult = {
  slug: "ahri",
  label: "Ahri",
  head: { idCount: 0, backfilled: 0 },
  historical: { idCount: 0, backfilled: 0, done: true, skipped: true },
};

const tick: SyncTick = {
  startedAt: "2026-05-19T12:00:00.000Z",
  finishedAt: "2026-05-19T12:00:01.000Z",
  durationMs: 1234,
  accounts: [accountResult],
};

function makeSnapshot(overrides: Partial<StatusSnapshot> = {}): StatusSnapshot {
  return {
    sync: {
      enabled: true,
      running: false,
      lastTick: tick,
      history: [tick],
    },
    rateLimiter: {
      capturedAt: "2026-05-19T12:00:00.000Z",
      app: [
        {
          regional: "europe",
          role: "fast",
          windowSec: 10,
          capacity: 20,
          reservoir: 18,
          counts: { RECEIVED: 0, QUEUED: 0, RUNNING: 0, EXECUTING: 0 },
        },
        {
          regional: "europe",
          role: "slow",
          windowSec: 600,
          capacity: 100,
          reservoir: 5,
          counts: { RECEIVED: 0, QUEUED: 0, RUNNING: 0, EXECUTING: 0 },
        },
      ],
      method: [],
    },
    ...overrides,
  };
}

type MutationLike = {
  mutate: ReturnType<typeof vi.fn>;
  isPending: boolean;
  variables?: unknown;
};

function fakeMutation(extra: Partial<MutationLike> = {}): MutationLike {
  return { mutate: vi.fn(), isPending: false, ...extra };
}

function mockStatus(value: {
  data?: StatusSnapshot;
  isPending?: boolean;
  error?: Error | null;
}) {
  vi.mocked(useStatus).mockReturnValue({
    data: value.data,
    isPending: value.isPending ?? false,
    error: value.error ?? null,
  } as unknown as ReturnType<typeof useStatus>);
}

function mockMe(me: Me | undefined) {
  vi.mocked(useMe).mockReturnValue({
    data: me,
  } as unknown as ReturnType<typeof useMe>);
}

function mockMutations(
  overrides: {
    syncNow?: Partial<MutationLike>;
    setEnabled?: Partial<MutationLike>;
    syncAccount?: Partial<MutationLike>;
  } = {}
): {
  syncNow: MutationLike;
  setEnabled: MutationLike;
  syncAccount: MutationLike;
} {
  const syncNow = fakeMutation(overrides.syncNow);
  const setEnabled = fakeMutation(overrides.setEnabled);
  const syncAccount = fakeMutation(overrides.syncAccount);
  vi.mocked(useSyncNow).mockReturnValue(
    syncNow as unknown as ReturnType<typeof useSyncNow>
  );
  vi.mocked(useSetSyncEnabled).mockReturnValue(
    setEnabled as unknown as ReturnType<typeof useSetSyncEnabled>
  );
  vi.mocked(useSyncAccount).mockReturnValue(
    syncAccount as unknown as ReturnType<typeof useSyncAccount>
  );
  return { syncNow, setEnabled, syncAccount };
}

beforeEach(() => {
  vi.mocked(useStatusStream).mockReturnValue(undefined);
  mockMe({ lol: [account], steam: [] });
  mockMutations();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("StatusPage", () => {
  it("renders the loading state while the snapshot is pending", () => {
    mockStatus({ isPending: true });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/Loading status/)).toBeTruthy();
  });

  it("renders the error state when the snapshot query errors", () => {
    mockStatus({ error: new Error("network down") });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/Failed to load status: network down/)).toBeTruthy();
  });

  it("falls back to 'unknown' when error is null but no data is present", () => {
    mockStatus({});
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/Failed to load status: unknown/)).toBeTruthy();
  });

  it("subscribes to the status SSE stream on mount", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(useStatusStream).toHaveBeenCalled();
  });

  it("renders sync card with header, metrics and app windows", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Match sync")).toBeTruthy();
    expect(screen.getByText("1234 ms")).toBeTruthy();
    // sumBackfilled = head.backfilled + historical.backfilled = 2 + 1 = 3
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/18 \/ 20/)).toBeTruthy();
  });

  it("shows the 'paused' badge when sync is disabled", () => {
    mockStatus({
      data: makeSnapshot({
        sync: { enabled: false, running: false, lastTick: tick, history: [tick] },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText("paused")).toBeTruthy();
  });

  it("shows the 'running' badge when sync is in flight", () => {
    mockStatus({
      data: makeSnapshot({
        sync: { enabled: true, running: true, lastTick: tick, history: [tick] },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText("running")).toBeTruthy();
  });

  it("shows the 'idle' badge when enabled, not running and a tick exists", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText("idle")).toBeTruthy();
  });

  it("renders the 'no tick yet' verdict when lastTick is null", () => {
    mockStatus({
      data: makeSnapshot({
        sync: { enabled: true, running: false, lastTick: null, history: [] },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/No tick has completed yet/)).toBeTruthy();
  });

  it("calls useSyncNow.mutate when 'Sync now' is clicked", () => {
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    expect(muts.syncNow.mutate).toHaveBeenCalled();
  });

  it("disables 'Sync now' while syncNow is pending", () => {
    mockMutations({ syncNow: { isPending: true } });
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(
      screen.getByRole("button", { name: /Sync now/ }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("disables 'Sync now' while a tick is running", () => {
    mockStatus({
      data: makeSnapshot({
        sync: { enabled: true, running: true, lastTick: tick, history: [tick] },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(
      screen.getByRole("button", { name: /Sync now/ }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("renders 'Resume' instead of 'Pause' when sync is disabled", () => {
    mockStatus({
      data: makeSnapshot({
        sync: { enabled: false, running: false, lastTick: tick, history: [tick] },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByRole("button", { name: /Resume/ })).toBeTruthy();
  });

  it("toggles enabled state via useSetSyncEnabled.mutate(!enabled)", () => {
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    expect(muts.setEnabled.mutate).toHaveBeenCalledWith(false, expect.any(Object));
  });

  it("renders an account row with head + historical states", () => {
    mockStatus({
      data: makeSnapshot({
        sync: {
          enabled: true,
          running: false,
          lastTick: { ...tick, accounts: [accountResult, errorAccountResult] },
          history: [tick],
        },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/head \+2 of 10/)).toBeTruthy();
    expect(screen.getByText(/hist \+1 of 5/)).toBeTruthy();
    expect(screen.getByText(/head error: boom/)).toBeTruthy();
    expect(screen.getByText(/hist error: kapow/)).toBeTruthy();
  });

  it("renders 'done' / 'waiting' historical states when skipped", () => {
    mockStatus({
      data: makeSnapshot({
        sync: {
          enabled: true,
          running: false,
          lastTick: { ...tick, accounts: [skippedAccountResult] },
          history: [tick],
        },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/hist done/)).toBeTruthy();
  });

  it("triggers per-account sync with the resolved account", () => {
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync Ahri" }));
    expect(muts.syncAccount.mutate).toHaveBeenCalledWith(account, expect.any(Object));
  });

  it("disables the per-account sync button when account is not resolvable", () => {
    mockMe({ lol: [], steam: [] });
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(
      screen.getByRole("button", { name: "Sync Ahri" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("shows a spinning sync icon when this specific account is being synced", () => {
    mockMutations({ syncAccount: { isPending: true, variables: account } });
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(
      screen.getByRole("button", { name: "Sync Ahri" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("renders the empty-method-limiter explanation when no method rows exist", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/No method limiters initialised yet/)).toBeTruthy();
  });

  it("renders a method-limiter table row when methods are present", () => {
    mockStatus({
      data: makeSnapshot({
        rateLimiter: {
          capturedAt: "2026-05-19T12:00:00.000Z",
          app: [],
          method: [
            {
              regional: "europe",
              family: "match-by-id",
              windowSec: 10,
              capacity: 20,
              reservoir: 7,
              counts: { RECEIVED: 0, QUEUED: 3, RUNNING: 0, EXECUTING: 2 },
            },
          ],
        },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText("match-by-id")).toBeTruthy();
    expect(screen.getByText(/7 \/ 20/)).toBeTruthy();
  });

  it("renders the 'Recent ticks' history section when more than one tick is present", () => {
    const tickOlder: SyncTick = {
      ...tick,
      startedAt: "2026-05-19T11:55:00.000Z",
      durationMs: 999,
      accounts: [accountResult],
    };
    mockStatus({
      data: makeSnapshot({
        sync: {
          enabled: true,
          running: false,
          lastTick: tick,
          history: [tick, tickOlder],
        },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/Recent ticks/)).toBeTruthy();
    expect(screen.getByText("999 ms")).toBeTruthy();
    // sumBackfilled(tickOlder) = 2 + 1 = 3 → "3 new matches"
    expect(screen.getByText(/3 new matches/)).toBeTruthy();
  });

  it("uses the singular 'match' wording in recent ticks when count is exactly 1", () => {
    const singleBackfill: SyncTickAccountResult = {
      slug: "solo",
      label: "Solo",
      head: { idCount: 1, backfilled: 1 },
      historical: { idCount: 0, backfilled: 0, done: true, skipped: true },
    };
    const tickWith1: SyncTick = {
      ...tick,
      startedAt: "2026-05-19T11:55:00.000Z",
      accounts: [singleBackfill],
    };
    mockStatus({
      data: makeSnapshot({
        sync: {
          enabled: true,
          running: false,
          lastTick: tick,
          history: [tick, tickWith1],
        },
      }),
    });
    renderWithTooltip(<StatusPage />);
    const history = screen.getByText(/Recent ticks/).parentElement;
    if (!history) throw new Error("missing recent-ticks parent");
    expect(within(history).getByText(/1 new match$/)).toBeTruthy();
  });
});
