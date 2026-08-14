import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminLolAccount, LolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LolAccountsTable } from "./lol-accounts-table";
import { type RosterRow, mergeRoster } from "./use-admin-accounts";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function renderTable(rows: RosterRow[], isOwner = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrap = (ui: ReactNode) => (
    <QueryClientProvider client={client}>
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
  return render(wrap(<LolAccountsTable rows={rows} isOwner={isOwner} />));
}

const primary: LolAccount = {
  slug: "ahri",
  gameName: "Vyoh",
  tagLine: "Ahri",
  region: "euw1",
  isOwner: true,
  isPrimary: true,
};
const friend: LolAccount = {
  slug: "twix",
  gameName: "Twix",
  tagLine: "1234",
  region: "euw1",
};

const detail = (over: Partial<AdminLolAccount>): AdminLolAccount => ({
  slug: "twix",
  gameName: "Twix",
  tagLine: "1234",
  region: "euw1",
  isOwner: false,
  isPrimary: false,
  hiddenAt: null,
  syncPausedAt: null,
  createdAt: "2026-08-13T23:01:24.000Z",
  ...over,
});

// The owner's view: the admin read covers every roster row, so both carry
// detail. A row without it is the anonymous case, exercised separately.
const rows = (over: Partial<AdminLolAccount> = {}) =>
  mergeRoster(
    [primary, friend],
    [
      detail({
        slug: "ahri",
        gameName: "Vyoh",
        tagLine: "Ahri",
        isOwner: true,
        isPrimary: true,
      }),
      detail(over),
    ]
  );

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(detail({}))))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LolAccountsTable", () => {
  it("renders hide and pause as state with a resting label", () => {
    // The whole reason these are toggles and not menu verbs: a roster where
    // three of nine rows are paused has to be readable without opening anything.
    renderTable(rows());
    expect(screen.getAllByText("Listed")).toHaveLength(2);
    expect(screen.getAllByText("Syncing")).toHaveLength(2);
  });

  it("reflects hidden and paused state, with the date each started", () => {
    renderTable(
      mergeRoster(
        [primary, { ...friend, hidden: true }],
        [
          detail({ slug: "ahri" }),
          detail({
            hiddenAt: "2026-03-03T10:00:00.000Z",
            syncPausedAt: "2026-04-04T10:00:00.000Z",
          }),
        ]
      )
    );
    expect(screen.getByText("Hidden")).toBeTruthy();
    expect(screen.getByText("Paused")).toBeTruthy();
    expect(screen.getByText("since 03 Mar 2026")).toBeTruthy();
    expect(screen.getByText("since 04 Apr 2026")).toBeTruthy();
  });

  it("hides an account by sending the flag the api owns the clock for", async () => {
    renderTable(rows());

    fireEvent.click(screen.getAllByText("Listed")[1] as HTMLElement);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:2010/admin/lol-accounts/twix",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ hidden: true }),
        })
      )
    );
  });

  it("pauses sync independently of visibility", async () => {
    renderTable(rows());

    fireEvent.click(screen.getAllByText("Syncing")[1] as HTMLElement);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:2010/admin/lol-accounts/twix",
        expect.objectContaining({ body: JSON.stringify({ syncPaused: true }) })
      )
    );
  });

  it("promotes by setting the flag, never by clearing the incumbent's", async () => {
    renderTable(rows());
    const crown = screen.getByRole("button", { name: "Primary account: Twix#1234" });

    // The already-primary row's crown is inert: clearing it would leave a roster
    // with owners and no primary, which the api rejects. Moving primary means
    // promoting another row, and the api demotes the incumbent in that same write.
    expect(
      screen
        .getByRole("button", { name: "Primary account: Vyoh#Ahri" })
        .hasAttribute("disabled")
    ).toBe(true);

    fireEvent.click(crown);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:2010/admin/lol-accounts/twix",
        expect.objectContaining({ body: JSON.stringify({ isPrimary: true }) })
      )
    );
  });

  it("toggles the owner flag both ways", async () => {
    renderTable(rows());

    fireEvent.click(screen.getByRole("button", { name: "Owner account: Twix#1234" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        "http://localhost:2010/admin/lol-accounts/twix",
        expect.objectContaining({ body: JSON.stringify({ isOwner: true }) })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Owner account: Vyoh#Ahri" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        "http://localhost:2010/admin/lol-accounts/ahri",
        expect.objectContaining({ body: JSON.stringify({ isOwner: false }) })
      )
    );
  });

  it("marks state on the control itself, not just in its label", () => {
    const marked = mergeRoster(
      [primary, { ...friend, hidden: true }],
      [detail({ slug: "ahri" }), detail({ hiddenAt: "2026-03-03T10:00:00.000Z" })]
    );
    renderTable(marked);
    expect(
      screen
        .getByRole("button", { name: "Owner account: Vyoh#Ahri" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Owner account: Twix#1234" })
        .getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("deletes without a confirm step — the api refuses the destructive case", async () => {
    renderTable(rows());

    fireEvent.click(screen.getByRole("button", { name: "Remove Twix#1234" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:2010/admin/lol-accounts/twix",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("locks every control for a visitor who is not the owner", () => {
    renderTable(rows(), false);
    for (const button of screen.getAllByRole("button")) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("withholds sync state rather than guessing it when the detail read is absent", () => {
    // The anonymous view. `syncPausedAt` only reaches the owner, so rendering
    // the toggle's default here would claim "Syncing" for a paused account —
    // the one state whose purpose is to explain why an account looks stale.
    renderTable(mergeRoster([primary, friend], undefined), false);
    expect(screen.queryByText("Syncing")).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(2);
    // Visibility is public — it rides on `/me` — so that column still reads.
    expect(screen.getAllByText("Listed")).toHaveLength(2);
  });

  it("says so when the roster is empty rather than rendering an empty table", () => {
    renderTable([]);
    expect(screen.getByText(/No accounts tracked yet/)).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = renderTable(rows());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
