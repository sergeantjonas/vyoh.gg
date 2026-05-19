import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { LolAccount } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshAccountButton } from "./refresh-account-button";

const toast = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastMessage: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/toast", () => toast);
vi.mock("@/lol/matches/use-matches", () => ({
  useSyncAccount: vi.fn(),
}));

import { useSyncAccount } from "@/lol/matches/use-matches";

const account: LolAccount = {
  slug: "me-euw",
  puuid: "p1",
  region: "euw1",
  routing: "europe",
  gameName: "Me",
  tagLine: "EUW",
  summonerLevel: 100,
  iconId: 1,
  snapshotTier: "PLATINUM",
  snapshotRank: "IV",
  snapshotLp: 50,
  snapshotLpBefore: 50,
  snapshotWins: 0,
  snapshotLosses: 0,
  snapshotQueue: 420,
  snapshotAt: new Date().toISOString(),
  syncedAt: new Date().toISOString(),
  visibility: "public",
} as unknown as LolAccount;

function makeSync(overrides: Partial<ReturnType<typeof useSyncAccount>>) {
  return {
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useSyncAccount>;
}

afterEach(() => {
  vi.mocked(useSyncAccount).mockReset();
  toast.toastSuccess.mockReset();
  toast.toastMessage.mockReset();
  toast.toastError.mockReset();
});

function renderButton(acc: LolAccount | undefined) {
  return render(
    <TooltipPrimitive.Provider>
      <RefreshAccountButton account={acc} />
    </TooltipPrimitive.Provider>
  );
}

describe("RefreshAccountButton", () => {
  it("renders disabled when no account is provided", () => {
    vi.mocked(useSyncAccount).mockReturnValue(makeSync({}));
    renderButton(undefined);
    const btn = screen.getByRole("button", {
      name: "Refresh matches",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("renders disabled with a spinning icon while pending", () => {
    vi.mocked(useSyncAccount).mockReturnValue(makeSync({ isPending: true }));
    const { container } = renderButton(account);
    const btn = screen.getByRole("button", {
      name: "Refresh matches",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "animate-spin"
    );
  });

  it("toasts success when sync returns backfilled matches", () => {
    const mutate = vi.fn((_input, options) => {
      options?.onSuccess?.({ backfilled: 3, idCount: 25 });
    });
    vi.mocked(useSyncAccount).mockReturnValue(makeSync({ mutate }));
    renderButton(account);
    fireEvent.click(screen.getByRole("button", { name: "Refresh matches" }));
    expect(toast.toastSuccess).toHaveBeenCalledWith("Synced — 3 new matches");
  });

  it("uses singular phrasing for a single backfilled match", () => {
    const mutate = vi.fn((_input, options) => {
      options?.onSuccess?.({ backfilled: 1, idCount: 25 });
    });
    vi.mocked(useSyncAccount).mockReturnValue(makeSync({ mutate }));
    renderButton(account);
    fireEvent.click(screen.getByRole("button", { name: "Refresh matches" }));
    expect(toast.toastSuccess).toHaveBeenCalledWith("Synced — 1 new match");
  });

  it("toasts the up-to-date message when no new matches were backfilled", () => {
    const mutate = vi.fn((_input, options) => {
      options?.onSuccess?.({ backfilled: 0, idCount: 25 });
    });
    vi.mocked(useSyncAccount).mockReturnValue(makeSync({ mutate }));
    renderButton(account);
    fireEvent.click(screen.getByRole("button", { name: "Refresh matches" }));
    expect(toast.toastMessage).toHaveBeenCalledWith(
      "Already up to date (25 recent matches)"
    );
  });

  it("toasts an error when sync fails", () => {
    const mutate = vi.fn((_input, options) => {
      options?.onError?.(new Error("rate-limited"));
    });
    vi.mocked(useSyncAccount).mockReturnValue(makeSync({ mutate }));
    renderButton(account);
    fireEvent.click(screen.getByRole("button", { name: "Refresh matches" }));
    expect(toast.toastError).toHaveBeenCalledWith("Sync failed: rate-limited");
  });
});
