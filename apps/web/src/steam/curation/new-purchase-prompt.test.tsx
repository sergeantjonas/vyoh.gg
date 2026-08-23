import {
  adminSteamGamesQueryKey,
  adminSteamReviewCountQueryKey,
} from "@/admin/use-admin-steam-games";
import { seedViewer } from "@/auth/mock-viewer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { AdminSteamGame } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewPurchasePrompt } from "./new-purchase-prompt";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function quarantined(appid: number, name: string | null): AdminSteamGame {
  return {
    appid,
    name,
    hiddenAt: "2026-08-23T02:15:00.000Z",
    unfeaturedAt: null,
    reviewedAt: null,
    note: null,
    createdAt: "2026-08-23T02:15:00.000Z",
  };
}

function ruled(appid: number): AdminSteamGame {
  return { ...quarantined(appid, "Old News"), reviewedAt: "2026-08-20T10:00:00.000Z" };
}

function renderPrompt({
  isOwner = true,
  entries = [] as AdminSteamGame[],
}: { isOwner?: boolean; entries?: AdminSteamGame[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client, isOwner);
  const pendingReview = entries.filter((entry) => entry.reviewedAt === null).length;
  client.setQueryData(adminSteamReviewCountQueryKey, { pendingReview });
  client.setQueryData(adminSteamGamesQueryKey, { entries, pendingReview });
  return render(
    <QueryClientProvider client={client}>
      <NewPurchasePrompt />
    </QueryClientProvider>
  );
}

function patchFor(appid: number) {
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => String(url).endsWith(`/admin/steam-games/${appid}`));
  const init = call?.[1] as RequestInit | undefined;
  return init?.body === undefined ? undefined : JSON.parse(String(init.body));
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(ruled(1)), { status: 200 })))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NewPurchasePrompt", () => {
  it("renders nothing for a visitor", () => {
    const { container } = renderPrompt({
      isOwner: false,
      entries: [quarantined(1091500, "Cyberpunk 2077")],
    });
    expect(container.textContent).toBe("");
  });

  it("renders nothing when every ruling has been made", () => {
    const { container } = renderPrompt({ entries: [ruled(730)] });
    expect(container.textContent).toBe("");
  });

  it("names the quarantined game and says it is hidden meanwhile", () => {
    renderPrompt({ entries: [quarantined(1091500, "Cyberpunk 2077")] });
    expect(screen.getByText("Cyberpunk 2077")).toBeTruthy();
    expect(
      screen.getByText(/hidden from visitors until you say otherwise/i)
    ).toBeTruthy();
  });

  it("publishes the game on 'Show it'", async () => {
    renderPrompt({ entries: [quarantined(1091500, "Cyberpunk 2077")] });
    await userEvent.click(screen.getByRole("button", { name: /show it/i }));
    await waitFor(() =>
      expect(patchFor(1091500)).toEqual({ hidden: false, reviewed: true })
    );
  });

  // The half the one-button toggle cannot express: a ruling that leaves the
  // game hidden. Sending `hidden` at all here would be a bug — it would read as
  // "hide it again" on a game that is already hidden.
  it("settles the question without unhiding on 'Keep hidden'", async () => {
    renderPrompt({ entries: [quarantined(1091500, "Cyberpunk 2077")] });
    await userEvent.click(screen.getByRole("button", { name: /keep hidden/i }));
    await waitFor(() => expect(patchFor(1091500)).toEqual({ reviewed: true }));
  });

  it("falls back to the appid when the poller never learned a name", () => {
    renderPrompt({ entries: [quarantined(1091500, null)] });
    expect(screen.getByText("App 1091500")).toBeTruthy();
  });

  // A bundle purchase should not turn the section header into a table.
  it("caps the list and points a bulk arrival at Status", () => {
    renderPrompt({
      entries: [
        quarantined(1, "One"),
        quarantined(2, "Two"),
        quarantined(3, "Three"),
        quarantined(4, "Four"),
        quarantined(5, "Five"),
      ],
    });
    expect(screen.getAllByRole("button", { name: /show it/i })).toHaveLength(3);
    const link = screen.getByRole("link", { name: /2 more waiting/i });
    expect(link.getAttribute("href")).toBe("/status");
  });

  it("has no axe violations", async () => {
    const { container } = renderPrompt({
      entries: [quarantined(1091500, "Cyberpunk 2077")],
    });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
