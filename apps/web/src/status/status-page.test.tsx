import { useIsOwner } from "@/auth/use-viewer";
import { useMe } from "@/identity/use-me";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type {
  LolAccount,
  Me,
  StatusSnapshot,
  SyncJobStatus,
  SyncTick,
  SyncTickAccountResult,
} from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusPage } from "./status-page";
import {
  useSetSyncEnabled,
  useStatus,
  useStatusStream,
  useSyncAccount,
  useSyncNow,
  useSyncPatches,
} from "./use-status";

vi.mock("./use-status", () => ({
  useStatus: vi.fn(),
  useStatusStream: vi.fn(),
  useSyncNow: vi.fn(),
  useSetSyncEnabled: vi.fn(),
  useSyncAccount: vi.fn(),
  useSyncPatches: vi.fn(),
}));

vi.mock("@/identity/use-me", () => ({ useMe: vi.fn() }));

// Stubbed rather than rendered: the section owns React Query hooks against the
// admin routes and has its own spec. What matters here is that the page mounts
// it, and where.
vi.mock("@/admin/tracked-accounts-section", () => ({
  TrackedAccountsSection: () => <section>Tracked accounts</section>,
}));

// Both owner-only sections are stubbed for the same reason: they own their own
// gated queries, and this file renders the page without a QueryClientProvider.
// Their gates are covered in their own tests.
vi.mock("@/admin/curated-games-section", () => ({
  CuratedGamesSection: () => <section>Curated Steam games</section>,
}));

vi.mock("@/auth/use-viewer", () => ({ useIsOwner: vi.fn() }));

// The page renders no router-aware component beyond the sign-in link, so a
// plain anchor is enough to assert where it points.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, search, children, ...rest }: LinkProps) => (
    <a href={`${to}?next=${search.next}`} {...rest}>
      {children}
    </a>
  ),
}));

type LinkProps = {
  to: string;
  search: { next?: string };
  children: ReactNode;
};

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

const steamJobs: SyncJobStatus[] = [
  {
    name: "steam-player-state",
    stream: "steam",
    label: "Now playing",
    cron: "*/2 * * * *",
    running: true,
    lastRun: null,
  },
  {
    name: "steam-owned-games",
    stream: "steam",
    label: "Owned games",
    cron: "*/15 * * * *",
    running: false,
    lastRun: {
      startedAt: "2026-05-19T11:45:00.000Z",
      finishedAt: "2026-05-19T11:45:00.812Z",
      durationMs: 812,
      outcome: "ok",
    },
  },
  {
    name: "steam-tag-catalog",
    stream: "steam",
    label: "Tag catalog",
    cron: "45 4 1 * *",
    running: false,
    lastRun: null,
  },
];

const lolJobs: SyncJobStatus[] = [
  {
    name: "lol-patch-notes",
    stream: "lol",
    label: "Patch notes",
    cron: "0 */6 * * *",
    running: false,
    lastRun: {
      startedAt: "2026-05-19T06:00:00.000Z",
      finishedAt: "2026-05-19T06:00:04.000Z",
      durationMs: 4000,
      outcome: "ok",
    },
  },
  {
    name: "lol-static-data",
    stream: "lol",
    label: "Static data",
    cron: "5 */6 * * *",
    running: false,
    lastRun: null,
  },
];

const failingJob: SyncJobStatus = {
  name: "steam-enrichment",
  stream: "steam",
  label: "Store enrichment",
  cron: "30 4 * * *",
  running: false,
  lastRun: {
    startedAt: "2026-05-19T04:30:00.000Z",
    finishedAt: "2026-05-19T04:30:02.000Z",
    durationMs: 2000,
    outcome: "error",
    error: "Steam Web API 503 Service Unavailable",
  },
};

function makeSnapshot(overrides: Partial<StatusSnapshot> = {}): StatusSnapshot {
  return {
    jobs: [...lolJobs, ...steamJobs],
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

function sectionFor(heading: string): HTMLElement {
  const section = screen.getByRole("heading", { name: heading }).closest("section");
  if (!section) throw new Error(`no section wrapping the "${heading}" heading`);
  return section as HTMLElement;
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
    syncPatches?: Partial<MutationLike>;
  } = {}
): {
  syncNow: MutationLike;
  setEnabled: MutationLike;
  syncAccount: MutationLike;
  syncPatches: MutationLike;
} {
  const syncNow = fakeMutation(overrides.syncNow);
  const setEnabled = fakeMutation(overrides.setEnabled);
  const syncAccount = fakeMutation(overrides.syncAccount);
  const syncPatches = fakeMutation(overrides.syncPatches);
  vi.mocked(useSyncNow).mockReturnValue(
    syncNow as unknown as ReturnType<typeof useSyncNow>
  );
  vi.mocked(useSetSyncEnabled).mockReturnValue(
    setEnabled as unknown as ReturnType<typeof useSetSyncEnabled>
  );
  vi.mocked(useSyncAccount).mockReturnValue(
    syncAccount as unknown as ReturnType<typeof useSyncAccount>
  );
  vi.mocked(useSyncPatches).mockReturnValue(
    syncPatches as unknown as ReturnType<typeof useSyncPatches>
  );
  return { syncNow, setEnabled, syncAccount, syncPatches };
}

beforeEach(() => {
  vi.mocked(useStatusStream).mockReturnValue(undefined);
  // Owner by default so the pre-auth cases below keep exercising the controls
  // themselves; the gated shape gets its own describe block.
  vi.mocked(useIsOwner).mockReturnValue(true);
  // /me returns LolAccountWithSummary[]; status-page doesn't read the
  // denorm fields, so a null summary stub is enough to satisfy the type.
  mockMe({ lol: [{ ...account, profileIconId: null, summary: null }], steam: [] });
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
    // Scoped to the card: the Steam poller rows carry a "running" badge of
    // their own, so an unscoped query would pass on the wrong section.
    expect(within(sectionFor("Match sync")).getByText("running")).toBeTruthy();
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
    // useMe now resolves to LolAccountWithSummary, so the mutate input
    // carries an extra `summary` field. Match on the bare LolAccount shape
    // via objectContaining to stay agnostic of the denorm payload.
    expect(muts.syncAccount.mutate).toHaveBeenCalledWith(
      expect.objectContaining(account),
      expect.any(Object)
    );
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

  it("fires toastInfo when syncNow.mutate resolves with triggered=true", async () => {
    const { toastInfo } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    const opts = muts.syncNow.mutate.mock.calls[0]?.[1] as {
      onSuccess: (r: { triggered: boolean; reason?: string }) => void;
    };
    opts.onSuccess({ triggered: true });
    expect(toastInfo).toHaveBeenCalledWith("Sync triggered");
  });

  it("fires toastError with the skip reason when syncNow resolves with triggered=false", async () => {
    const { toastError } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    const opts = muts.syncNow.mutate.mock.calls[0]?.[1] as {
      onSuccess: (r: { triggered: boolean; reason?: string }) => void;
    };
    opts.onSuccess({ triggered: false, reason: "cooldown" });
    expect(toastError).toHaveBeenCalledWith("Sync skipped: cooldown");
  });

  it("falls back to 'unknown' reason when syncNow returns triggered=false without a reason", async () => {
    const { toastError } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    const opts = muts.syncNow.mutate.mock.calls[0]?.[1] as {
      onSuccess: (r: { triggered: boolean; reason?: string }) => void;
    };
    opts.onSuccess({ triggered: false });
    expect(toastError).toHaveBeenCalledWith("Sync skipped: unknown");
  });

  it("fires toastError when syncNow.mutate rejects", async () => {
    const { toastError } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
    const opts = muts.syncNow.mutate.mock.calls[0]?.[1] as {
      onError: (e: Error) => void;
    };
    opts.onError(new Error("upstream 502"));
    expect(toastError).toHaveBeenCalledWith("Sync failed: upstream 502");
  });

  it("fires toastInfo when setEnabled.mutate resolves (paused→resumed branch)", async () => {
    const { toastInfo } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({
      data: makeSnapshot({
        sync: { enabled: false, running: false, lastTick: tick, history: [tick] },
      }),
    });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Resume/ }));
    const opts = muts.setEnabled.mutate.mock.calls[0]?.[1] as {
      onSuccess: () => void;
    };
    opts.onSuccess();
    expect(toastInfo).toHaveBeenCalledWith("Sync resumed");
  });

  it("fires toastError when setEnabled.mutate rejects", async () => {
    const { toastError } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: /Pause/ }));
    const opts = muts.setEnabled.mutate.mock.calls[0]?.[1] as {
      onError: (e: Error) => void;
    };
    opts.onError(new Error("forbidden"));
    expect(toastError).toHaveBeenCalledWith("Toggle failed: forbidden");
  });

  it("toasts when per-account sync rejects (with plural matches wording when count != 1)", async () => {
    const { toastSuccess, toastError } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync Ahri" }));
    const opts = muts.syncAccount.mutate.mock.calls[0]?.[1] as {
      onSuccess: (r: { backfilled: number; idCount: number }) => void;
      onError: (e: Error) => void;
    };
    opts.onSuccess({ backfilled: 5, idCount: 10 });
    expect(toastSuccess).toHaveBeenCalledWith("+5 new matches (10 ids)");
    opts.onError(new Error("riot rate-limit"));
    expect(toastError).toHaveBeenCalledWith("Sync failed: riot rate-limit");
  });

  it("uses singular wording when per-account sync returns exactly 1 new match", async () => {
    const { toastSuccess } = await import("@/lib/toast");
    const muts = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sync Ahri" }));
    const opts = muts.syncAccount.mutate.mock.calls[0]?.[1] as {
      onSuccess: (r: { backfilled: number; idCount: number }) => void;
    };
    opts.onSuccess({ backfilled: 1, idCount: 1 });
    expect(toastSuccess).toHaveBeenCalledWith("+1 new match (1 ids)");
  });

  it("renders the destructive tone bar when an app window's reservoir is below 20%", () => {
    mockStatus({
      data: makeSnapshot({
        rateLimiter: {
          capturedAt: "2026-05-19T12:00:00.000Z",
          app: [
            {
              regional: "europe",
              role: "fast",
              windowSec: 10,
              capacity: 100,
              reservoir: 5,
              counts: { RECEIVED: 0, QUEUED: 0, RUNNING: 0, EXECUTING: 0 },
            },
          ],
          method: [],
        },
      }),
    });
    const { container } = renderWithTooltip(<StatusPage />);
    // 5/100 = 5% → destructive tone
    expect(container.querySelectorAll(".bg-destructive").length).toBeGreaterThan(0);
  });

  it("renders the amber tone bar when an app window's reservoir is 20–50%", () => {
    mockStatus({
      data: makeSnapshot({
        rateLimiter: {
          capturedAt: "2026-05-19T12:00:00.000Z",
          app: [
            {
              regional: "europe",
              role: "fast",
              windowSec: 10,
              capacity: 100,
              reservoir: 30,
              counts: { RECEIVED: 0, QUEUED: 0, RUNNING: 0, EXECUTING: 0 },
            },
          ],
          method: [],
        },
      }),
    });
    const { container } = renderWithTooltip(<StatusPage />);
    expect(container.querySelectorAll(".bg-amber-500").length).toBeGreaterThan(0);
  });

  it("treats null reservoir as a full window (100% emerald tone)", () => {
    mockStatus({
      data: makeSnapshot({
        rateLimiter: {
          capturedAt: "2026-05-19T12:00:00.000Z",
          app: [
            {
              regional: "europe",
              role: "fast",
              windowSec: 10,
              capacity: 100,
              reservoir: null,
              counts: { RECEIVED: 0, QUEUED: 0, RUNNING: 0, EXECUTING: 0 },
            },
          ],
          method: [],
        },
      }),
    });
    const { container } = renderWithTooltip(<StatusPage />);
    expect(container.querySelectorAll(".bg-emerald-500").length).toBeGreaterThan(0);
  });

  it("shows 'waiting' when historical is skipped but not yet done", () => {
    mockStatus({
      data: makeSnapshot({
        sync: {
          enabled: true,
          running: false,
          lastTick: {
            ...tick,
            accounts: [
              {
                slug: "ahri",
                label: "Ahri",
                head: { idCount: 0, backfilled: 0 },
                historical: { idCount: 0, backfilled: 0, done: false, skipped: true },
              },
            ],
          },
          history: [tick],
        },
      }),
    });
    renderWithTooltip(<StatusPage />);
    expect(screen.getByText(/hist waiting/)).toBeTruthy();
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

describe("StatusPage owner gating", () => {
  const buttons = () => ({
    syncNow: screen.getByRole("button", { name: "Sync now" }),
    toggle: screen.getByRole("button", { name: "Pause" }),
    account: screen.getByRole("button", { name: "Sync Ahri" }),
  });

  it("locks every write control for an anonymous visitor", () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const { syncNow, toggle, account } = buttons();
    expect(syncNow.hasAttribute("disabled")).toBe(true);
    expect(toggle.hasAttribute("disabled")).toBe(true);
    expect(account.hasAttribute("disabled")).toBe(true);
  });

  it("offers a way out of the locked state, carrying where to return", () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    // A row of padlocks with no route to unlocking them is the failure this
    // link exists to prevent — it is the only entry to /login in the app.
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link.getAttribute("href")).toBe("/login?next=/status");
  });

  it("drops the sign-in link once signed in", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
  });

  it("keeps the locked controls rendered rather than hiding them", () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    // The page has to describe what it can do to a visitor who can't do it —
    // hiding the controls would make it a different page depending on who looks.
    expect(screen.getByText("Sync now")).toBeTruthy();
    expect(screen.getByText("Pause")).toBeTruthy();
  });

  it("unlocks the controls once the viewer is the owner", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const { syncNow, toggle, account } = buttons();
    expect(syncNow.hasAttribute("disabled")).toBe(false);
    expect(toggle.hasAttribute("disabled")).toBe(false);
    expect(account.hasAttribute("disabled")).toBe(false);
  });

  it("does not fire the mutation when a locked control is clicked", () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    const { syncNow: syncNowMutation } = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    fireEvent.click(buttons().syncNow);
    expect(syncNowMutation.mutate).not.toHaveBeenCalled();
  });

  it("has no axe violations in the locked state", async () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    mockStatus({ data: makeSnapshot() });
    const { container } = renderWithTooltip(<StatusPage />);
    // color-contrast needs real computed styles, which happy-dom does not
    // produce; `disabled` on the controls is what the scan is here for.
    const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });
    expect((await axe(container)).violations).toEqual([]);
  });

  it("explains the lock on hover rather than leaving the control mysteriously dead", async () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    // Hovering the wrapper, not the button: a disabled button eats pointer
    // events, which is why the trigger is a span around it.
    const wrapper = screen.getByRole("button", { name: "Sync now" }).parentElement;
    if (!wrapper) throw new Error("missing tooltip trigger wrapper");
    fireEvent.pointerEnter(wrapper);
    fireEvent.focus(wrapper);

    const copy = await screen.findAllByText("Owner-only — sign in to enable.");
    expect(copy.length).toBeGreaterThan(0);
  });
});

describe("StatusPage — Steam sync", () => {
  beforeEach(() => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    mockMe(undefined);
    mockMutations();
  });

  it("lists a row per Steam job with its label and schedule", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const card = within(sectionFor("Steam sync"));
    for (const job of steamJobs) {
      expect(card.getByText(job.label)).toBeTruthy();
      expect(card.getByText(job.cron ?? "on demand")).toBeTruthy();
    }
  });

  it("reports a job with no recorded run as pending rather than healthy", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const row = rowFor("Tag catalog");
    expect(within(row).getByText("pending")).toBeTruthy();
    expect(within(row).getByText("no run since boot")).toBeTruthy();
  });

  it("shows the duration of a job's last successful run", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const row = rowFor("Owned games");
    expect(within(row).getByText("ok")).toBeTruthy();
    expect(within(row).getByText(/812 ms/)).toBeTruthy();
  });

  it("badges an in-flight job as running", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    expect(within(rowFor("Now playing")).getByText("running")).toBeTruthy();
  });

  // A swallowed poller failure is the whole reason these rows exist, so the
  // message has to reach the page, not just the badge.
  it("surfaces the recorded error message on a failed job", () => {
    mockStatus({ data: makeSnapshot({ jobs: [...steamJobs, failingJob] }) });
    renderWithTooltip(<StatusPage />);

    const row = rowFor("Store enrichment");
    expect(within(row).getByText("failed")).toBeTruthy();
    expect(
      within(row).getByText(/error: Steam Web API 503 Service Unavailable/)
    ).toBeTruthy();
  });

  it("labels an on-demand job in place of a cron expression", () => {
    const onDemand: SyncJobStatus = {
      name: "steam-game-refresh",
      stream: "steam",
      label: "Per-game refresh",
      cron: null,
      running: false,
      lastRun: null,
    };
    mockStatus({ data: makeSnapshot({ jobs: [...steamJobs, onDemand] }) });
    renderWithTooltip(<StatusPage />);

    expect(within(rowFor("Per-game refresh")).getByText("on demand")).toBeTruthy();
  });

  it("counts the failing jobs in the card header", () => {
    mockStatus({ data: makeSnapshot({ jobs: [...steamJobs, failingJob] }) });
    renderWithTooltip(<StatusPage />);

    expect(within(sectionFor("Steam sync")).getByText("1 failing")).toBeTruthy();
  });

  it("says so when the api reports no scheduled jobs at all", () => {
    mockStatus({ data: makeSnapshot({ jobs: [] }) });
    renderWithTooltip(<StatusPage />);

    expect(
      within(sectionFor("Steam sync")).getByText(/No scheduled jobs reported/)
    ).toBeTruthy();
  });

  // The card is read-only by design, so a non-owner sees the same thing the
  // owner does — no locked control, and nothing hidden.
  it("shows the same rows to a non-owner, with no controls", () => {
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const card = within(sectionFor("Steam sync"));
    expect(card.getByText("Owned games")).toBeTruthy();
    expect(card.queryAllByRole("button")).toEqual([]);
  });

  it("has no axe violations", async () => {
    mockStatus({ data: makeSnapshot({ jobs: [...steamJobs, failingJob] }) });
    const { container } = renderWithTooltip(<StatusPage />);

    const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("StatusPage — LoL data sync", () => {
  it("lists both LoL cron jobs, separate from the match-sync card", () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const card = within(sectionFor("LoL data sync"));
    expect(card.getByText("Patch notes")).toBeTruthy();
    expect(card.getByText("Static data")).toBeTruthy();
    // The Steam rows belong to their own card, not this one.
    expect(card.queryByText("Owned games")).toBeNull();
  });

  it("triggers a patch fetch when the owner clicks the control", () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    const { syncPatches } = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    fireEvent.click(screen.getByRole("button", { name: "Fetch patch notes" }));
    expect(syncPatches.mutate).toHaveBeenCalledOnce();
  });

  it("offers the trigger on the patch job only, not on static data", () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    expect(within(rowFor("Patch notes")).getByRole("button")).toBeTruthy();
    expect(within(rowFor("Static data")).queryAllByRole("button")).toEqual([]);
  });

  it("renders the trigger locked for a non-owner", () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    const { syncPatches } = mockMutations();
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    const button = screen.getByRole("button", { name: "Fetch patch notes" });
    expect(button.hasAttribute("disabled")).toBe(true);

    // Locked, not merely styled as locked — a click must not reach the api.
    fireEvent.click(button);
    expect(syncPatches.mutate).not.toHaveBeenCalled();
  });

  it("explains the lock on hover rather than leaving the control dead", async () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    mockStatus({ data: makeSnapshot() });
    renderWithTooltip(<StatusPage />);

    // The wrapper, not the button: a disabled button eats pointer events.
    const wrapper = screen.getByRole("button", {
      name: "Fetch patch notes",
    }).parentElement;
    if (!wrapper) throw new Error("missing tooltip trigger wrapper");
    fireEvent.pointerEnter(wrapper);
    fireEvent.focus(wrapper);

    expect(
      (await screen.findAllByText("Owner-only — sign in to enable.")).length
    ).toBeGreaterThan(0);
  });

  // The job is already in flight, so a second trigger would only be refused by
  // the api — disable it here rather than spend the round trip.
  it("disables the trigger while the job is already running", () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    mockStatus({
      data: makeSnapshot({
        jobs: [{ ...lolJobs[0], running: true } as SyncJobStatus, ...steamJobs],
      }),
    });
    renderWithTooltip(<StatusPage />);

    expect(
      screen.getByRole("button", { name: "Fetch patch notes" }).hasAttribute("disabled")
    ).toBe(true);
  });

  it("has no axe violations with the trigger rendered", async () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    mockStatus({ data: makeSnapshot() });
    const { container } = renderWithTooltip(<StatusPage />);

    const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });
    expect((await axe(container)).violations).toEqual([]);
  });
});

function rowFor(label: string): HTMLElement {
  const row = screen.getByText(label).closest("li");
  if (!row) throw new Error(`no job row for "${label}"`);
  return row as HTMLElement;
}
