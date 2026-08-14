import { useIsOwner } from "@/auth/use-viewer";
import { useMe } from "@/identity/use-me";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { Me } from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackedAccountsSection } from "./tracked-accounts-section";

vi.mock("@/identity/use-me", () => ({ useMe: vi.fn() }));
vi.mock("@/auth/use-viewer", () => ({ useIsOwner: vi.fn() }));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const me: Me = {
  lol: [
    {
      slug: "ahri",
      gameName: "Vyoh",
      tagLine: "Ahri",
      region: "euw1",
      isOwner: true,
      isPrimary: true,
      profileIconId: null,
      summary: null,
    },
    {
      slug: "twix",
      gameName: "Twix",
      tagLine: "1234",
      region: "euw1",
      hidden: true,
      profileIconId: null,
      summary: null,
    },
  ],
  steam: ["76561198000000001"],
};

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
  vi.mocked(useMe).mockReturnValue({ data: me } as ReturnType<typeof useMe>);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]")));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TrackedAccountsSection", () => {
  it("renders both rosters from the public payload", () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    renderSection();

    expect(screen.getByText("Tracked accounts")).toBeTruthy();
    expect(screen.getByText("Vyoh#Ahri")).toBeTruthy();
    expect(screen.getByText("76561198000000001")).toBeTruthy();
  });

  it("reads the roster from /me, so a hidden account is still managed here", () => {
    // The nav filters hidden accounts out; this table must not, or the only
    // control that could un-hide one would disappear with it.
    vi.mocked(useIsOwner).mockReturnValue(true);
    renderSection();
    expect(screen.getByText("Twix#1234")).toBeTruthy();
    expect(screen.getByText("Hidden")).toBeTruthy();
  });

  it("fetches the owner-only detail once the session is confirmed", () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    renderSection();
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:2010/admin/lol-accounts",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("asks for nothing and locks the cards for an anonymous visitor", () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    renderSection();

    // Two locks, one per card — not one per control, which would read as ten
    // separate problems instead of one signed-out session.
    expect(screen.getAllByLabelText("Read-only — owner sign-in required")).toHaveLength(
      2
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button.hasAttribute("disabled")).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the same layout signed out — the cards and headers stay", () => {
    vi.mocked(useIsOwner).mockReturnValue(false);
    renderSection();
    expect(screen.getByText("League accounts")).toBeTruthy();
    expect(screen.getByText("Steam accounts")).toBeTruthy();
    expect(screen.getAllByText("Add account")).toHaveLength(2);
  });

  it("has no axe violations", async () => {
    vi.mocked(useIsOwner).mockReturnValue(true);
    const { container } = renderSection();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
