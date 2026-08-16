import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminLolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurgeAccountDialog } from "./purge-account-dialog";

vi.mock("@/lib/toast", () => ({ toastSuccess: vi.fn() }));

const axe = configureAxe({
  rules: {
    // Needs real computed styles, which happy-dom doesn't produce.
    "color-contrast": { enabled: false },
    // Radix Dialog false positive under happy-dom.
    "aria-hidden-focus": { enabled: false },
  },
});

const ACCOUNT: AdminLolAccount = {
  slug: "agurin",
  gameName: "Agurin",
  tagLine: "DND",
  region: "euw1",
  isOwner: false,
  isPrimary: false,
  hiddenAt: null,
  syncPausedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const PREVIEW = {
  slug: "agurin",
  gameName: "Agurin",
  tagLine: "DND",
  region: "euw1",
  summoners: 1,
  matches: 1973,
  rankSnapshots: 458,
  detailCacheRows: 1972,
  timelineCacheRows: 937,
  estimatedBytes: 170_677_265,
};

function renderDialog(account: AdminLolAccount | null = ACCOUNT) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <PurgeAccountDialog account={account} onClose={onClose} />
    </QueryClientProvider>
  );
  return { ...view, onClose };
}

const confirmButton = () => screen.getByRole("button", { name: /Purge everything/ });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(PREVIEW)))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PurgeAccountDialog", () => {
  it("stays closed with no account, and asks for no counts", () => {
    renderDialog(null);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows what the purge would remove, per table", async () => {
    renderDialog();

    // Formatted with separators — six figures of raw digits is exactly the
    // number an operator skims past.
    expect(await screen.findByText("1,973")).toBeTruthy();
    expect(screen.getByText("458")).toBeTruthy();
    expect(screen.getByText("1,972")).toBeTruthy();
    expect(screen.getByText("937")).toBeTruthy();
    expect(screen.getByText(/Frees ~171 MB/)).toBeTruthy();
  });

  it("keeps the purge button inert until the slug is typed back exactly", async () => {
    renderDialog();
    await screen.findByText("1,973");

    expect(confirmButton().hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText(/to confirm/), {
      target: { value: "aguri" },
    });
    expect(confirmButton().hasAttribute("disabled")).toBe(true);

    // Not case-insensitive, and not trimmed: the api compares exactly, so an
    // enabled button that the api then rejects would be the worse failure.
    fireEvent.change(screen.getByLabelText(/to confirm/), {
      target: { value: "Agurin" },
    });
    expect(confirmButton().hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText(/to confirm/), {
      target: { value: "agurin" },
    });
    expect(confirmButton().hasAttribute("disabled")).toBe(false);
  });

  it("sends the typed confirmation in the body, not just the path", async () => {
    renderDialog();
    await screen.findByText("1,973");
    fireEvent.change(screen.getByLabelText(/to confirm/), {
      target: { value: "agurin" },
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ slug: "agurin", matches: 1973 }))
    );
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:2010/admin/lol-accounts/agurin/purge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ confirm: "agurin" }),
        })
      )
    );
  });

  it("says so plainly when there is nothing but the roster row to remove", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          ...PREVIEW,
          summoners: 0,
          matches: 0,
          rankSnapshots: 0,
          detailCacheRows: 0,
          timelineCacheRows: 0,
          estimatedBytes: 0,
        })
      )
    );
    renderDialog();

    expect(await screen.findByText(/No synced history/)).toBeTruthy();
  });

  it("surfaces a failed purge without closing or clearing the confirmation", async () => {
    renderDialog();
    await screen.findByText("1,973");
    fireEvent.change(screen.getByLabelText(/to confirm/), {
      target: { value: "agurin" },
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "Purge failed." }), { status: 500 })
    );
    fireEvent.click(confirmButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Purge failed.");
    expect(screen.getByLabelText(/to confirm/)).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { baseElement } = renderDialog();
    await screen.findByText("1,973");

    const results = await axe(baseElement);
    expect(results.violations).toEqual([]);
  });
});
