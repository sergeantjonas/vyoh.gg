import { adminSteamGamesQueryKey } from "@/admin/use-admin-steam-games";
import { seedViewer } from "@/auth/mock-viewer";
import * as Tooltip from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { AdminSteamGame } from "@vyoh/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HideGameButton } from "./hide-game-button";

const APPID = 730;

function row(overrides: Partial<AdminSteamGame> = {}): AdminSteamGame {
  return {
    appid: APPID,
    name: "Counter-Strike 2",
    hiddenAt: null,
    unfeaturedAt: null,
    reviewedAt: "2026-08-20T10:00:00.000Z",
    note: null,
    createdAt: "2026-08-20T10:00:00.000Z",
    recentPlaytimeMinutes: null,
    ...overrides,
  };
}

function renderButton({
  isOwner = true,
  entries = [] as AdminSteamGame[],
  name,
  className,
}: {
  isOwner?: boolean;
  entries?: AdminSteamGame[];
  name?: string | null;
  className?: string;
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client, isOwner);
  client.setQueryData(adminSteamGamesQueryKey, {
    entries,
    pendingReview: entries.filter((entry) => entry.reviewedAt === null).length,
  });
  return render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <HideGameButton appid={APPID} name={name} className={className} />
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}

function patchBody(): unknown {
  const call = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => String(url).endsWith(`/admin/steam-games/${APPID}`));
  const init = call?.[1] as RequestInit | undefined;
  return init?.body === undefined ? undefined : JSON.parse(String(init.body));
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

describe("HideGameButton", () => {
  // Not a disabled control: a locked "Hide from visitors" next to every game
  // describes a capability the page cannot offer.
  it("renders nothing at all for a visitor", () => {
    renderButton({ isOwner: false });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers to hide a game with no overlay row", () => {
    renderButton();
    const button = screen.getByRole("button", { name: /hide from visitors/i });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.textContent).toContain("Hide");
  });

  it("reads as pressed for a game that is already hidden", () => {
    renderButton({ entries: [row({ hiddenAt: "2026-08-20T12:00:00.000Z" })] });
    const button = screen.getByRole("button", { name: /visible to visitors again/i });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toContain("Hidden");
  });

  // The reviewed stamp travels with every press: approving a quarantined game
  // and still being asked about it would make the review badge a liar.
  it("hides the game and records the ruling in one request", async () => {
    renderButton();
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(patchBody()).toEqual({ hidden: true, reviewed: true }));
  });

  it("unhides a hidden game", async () => {
    renderButton({ entries: [row({ hiddenAt: "2026-08-20T12:00:00.000Z" })] });
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(patchBody()).toEqual({ hidden: false, reviewed: true }));
  });

  // Without credentials the api answers 401 and the toggle silently never works.
  it("sends the session cookie", async () => {
    renderButton();
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      const call = vi
        .mocked(fetch)
        .mock.calls.find(([url]) => String(url).endsWith(`/admin/steam-games/${APPID}`));
      expect(call?.[1]).toMatchObject({ credentials: "include", method: "PATCH" });
    });
  });

  // A wishlisted appid has no owned-game row, so the api has nothing to take a
  // label from and `/status` would list it as a bare "App 730" forever.
  it("forwards the title so an unowned game's row gets a label", async () => {
    renderButton({ name: "Counter-Strike 2" });
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(patchBody()).toEqual({
        hidden: true,
        reviewed: true,
        name: "Counter-Strike 2",
      })
    );
  });

  // Callers render their own placeholder for an unresolvable title; persisting
  // one into the overlay would store "Unknown title (app 730)" as data.
  it("omits the title entirely when the surface does not know it", async () => {
    renderButton({ name: null });
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(patchBody()).toEqual({ hidden: true, reviewed: true }));
  });

  // The tooltip trigger is the outermost box and the element Radix anchors the
  // hint to. Styling the button instead leaves the trigger free to stretch in a
  // flex row, and the hint then floats a full row clear of the control.
  it("puts layout classes on the tooltip trigger, not on the button", () => {
    renderButton({ className: "shrink-0" });
    const button = screen.getByRole("button");
    expect(button.className).not.toContain("shrink-0");
    expect(button.parentElement?.className).toContain("shrink-0");
  });

  it("marks a quarantined game as still awaiting a ruling", () => {
    renderButton({
      entries: [row({ hiddenAt: "2026-08-21T03:00:00.000Z", reviewedAt: null })],
    });
    expect(screen.getByRole("button").className).toContain("border-dashed");
  });
});
