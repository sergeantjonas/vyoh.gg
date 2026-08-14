import { useIsOwner } from "@/auth/use-viewer";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { AdminLolAccount } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackedAccountsSection } from "./tracked-accounts-section";

vi.mock("@/auth/use-viewer", () => ({ useIsOwner: vi.fn() }));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const roster: AdminLolAccount[] = [
  {
    slug: "ahri",
    gameName: "Vyoh",
    tagLine: "Ahri",
    region: "euw1",
    isOwner: true,
    isPrimary: true,
    hiddenAt: null,
    syncPausedAt: null,
    createdAt: "2026-08-13T23:01:17.000Z",
  },
  {
    slug: "twix",
    gameName: "Twix",
    tagLine: "1234",
    region: "euw1",
    isOwner: false,
    isPrimary: false,
    hiddenAt: "2026-03-03T10:00:00.000Z",
    syncPausedAt: null,
    createdAt: "2026-08-13T23:01:24.000Z",
  },
];

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui: ReactNode = (
    <QueryClientProvider client={client}>
      <TooltipPrimitive.Provider>
        <TrackedAccountsSection />
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
  return render(ui);
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("lol-accounts")
        ? new Response(JSON.stringify(roster))
        : new Response("[]")
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TrackedAccountsSection", () => {
  it("renders both rosters for the owner", async () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    renderSection();

    expect(screen.getByText("Tracked accounts")).toBeTruthy();
    expect(await screen.findByText("Vyoh#Ahri")).toBeTruthy();
    expect(screen.getByText("League accounts")).toBeTruthy();
    expect(screen.getByText("Steam accounts")).toBeTruthy();
  });

  it("lists a hidden account — the nav drops it, the manager must not", async () => {
    // Otherwise the only control that could un-hide an account disappears along
    // with it.
    vi.mocked(useIsOwner).mockReturnValue(true);
    renderSection();
    expect(await screen.findByText("Twix#1234")).toBeTruthy();
    expect(screen.getByText("Hidden")).toBeTruthy();
  });

  it("renders nothing at all for a visitor who is not the owner", () => {
    // Not a read-only variant: the account list is already in the nav, so a
    // locked copy of it would be a duplicate wrapped in dead controls.
    vi.mocked(useIsOwner).mockReturnValue(false);
    const { container } = renderSection();

    expect(container.innerHTML).toBe("");
    expect(screen.queryByText("Tracked accounts")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says it is loading rather than claiming an empty roster", () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}) as Promise<Response>);
    renderSection();
    expect(screen.getAllByText("Loading roster…")).toHaveLength(2);
  });

  it("has no axe violations", async () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    const { container } = renderSection();
    await waitFor(() => expect(screen.getByText("Vyoh#Ahri")).toBeTruthy());
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
