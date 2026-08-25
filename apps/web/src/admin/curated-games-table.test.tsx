import { seedViewer } from "@/auth/mock-viewer";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { AdminSteamGame } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CuratedGamesTable } from "./curated-games-table";

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function row(overrides: Partial<AdminSteamGame> = {}): AdminSteamGame {
  return {
    appid: 1091500,
    name: "Cyberpunk 2077",
    hiddenAt: null,
    unfeaturedAt: null,
    reviewedAt: "2026-08-21T03:50:00.000Z",
    note: null,
    createdAt: "2026-08-21T03:50:00.000Z",
    recentPlaytimeMinutes: null,
    ...overrides,
  };
}

function renderTable(rows: AdminSteamGame[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client, true);
  return render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <CuratedGamesTable rows={rows} />
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}

function lastRequest() {
  const call = vi.mocked(fetch).mock.calls.at(-1);
  const init = call?.[1] as RequestInit | undefined;
  return {
    url: String(call?.[0]),
    method: init?.method,
    body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(row()), { status: 200 })))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CuratedGamesTable", () => {
  it("explains what an empty overlay means rather than rendering an empty table", () => {
    renderTable([]);
    expect(screen.getByText(/new purchases land here quarantined/i)).toBeTruthy();
  });

  // The two axes are separate decisions. A single "curated" toggle would mean
  // un-hiding a game silently re-promotes it to a chapter on `/`.
  it("patches only the visibility axis when visibility is toggled", async () => {
    renderTable([row({ unfeaturedAt: "2026-08-21T03:50:00.000Z" })]);
    await userEvent.click(screen.getByRole("button", { name: /hide from visitors/i }));
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ method: "PATCH", body: { hidden: true } })
    );
    expect(lastRequest().body).not.toHaveProperty("unfeatured");
  });

  it("patches only the featuring axis when featuring is toggled", async () => {
    renderTable([row({ hiddenAt: "2026-08-21T03:50:00.000Z" })]);
    await userEvent.click(
      screen.getByRole("button", { name: /never feature as a chapter/i })
    );
    await waitFor(() => expect(lastRequest().body).toEqual({ unfeatured: true }));
  });

  // This is the affordance the in-context toggle cannot offer: "I looked, keep
  // it hidden" — a ruling that changes nothing about what visitors see.
  it("lets the owner settle a review without touching either flag", async () => {
    renderTable([row({ hiddenAt: "2026-08-21T03:00:00.000Z", reviewedAt: null })]);
    await userEvent.click(screen.getByRole("button", { name: /needs review/i }));
    await waitFor(() => expect(lastRequest().body).toEqual({ reviewed: true }));
  });

  it("shows the review date once a ruling exists, not a button", () => {
    renderTable([row()]);
    expect(screen.queryByRole("button", { name: /needs review/i })).toBeNull();
    expect(screen.getByText("21 Aug 2026")).toBeTruthy();
  });

  it("reflects both axes as pressed state", () => {
    renderTable([
      row({
        hiddenAt: "2026-08-21T03:50:00.000Z",
        unfeaturedAt: "2026-08-21T03:50:00.000Z",
      }),
    ]);
    expect(
      screen
        .getByRole("button", { name: /show to visitors/i })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: /allow as a chapter/i })
        .getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("deletes the row through DELETE, not a hidden:false patch", async () => {
    renderTable([row({ hiddenAt: "2026-08-21T03:50:00.000Z" })]);
    await userEvent.click(screen.getByRole("button", { name: /forget this ruling/i }));
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({
        method: "DELETE",
        url: expect.stringContaining("/admin/steam-games/1091500"),
      })
    );
  });

  it("has no axe violations", async () => {
    const { container } = renderTable([row({ reviewedAt: null })]);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
