import { render, screen } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import { Crown, History, LayoutDashboard, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { type BreadcrumbSection, MatchesBreadcrumb } from "./matches-breadcrumb";

// Link renders via TanStack; stub it to a plain anchor so the breadcrumb mounts
// without a RouterProvider (mirrors section-shell.test.tsx).
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    search: _search,
    ...rest
  }: {
    children: ReactNode;
    to?: string;
    params?: unknown;
    search?: unknown;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

// The back link captures the origin rect via the active-match context; stub it
// so the component mounts without ActiveMatchProvider.
vi.mock("@/lol/matches/active-match-context", () => ({
  useActiveMatch: () => ({ setOriginRect: vi.fn() }),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

const SECTIONS: readonly BreadcrumbSection[] = [
  { to: "/lol/$accountSlug", label: "Profile", Icon: LayoutDashboard },
  { to: "/lol/$accountSlug/matches", label: "Matches", Icon: History },
  { to: "/lol/$accountSlug/trends", label: "Trends", Icon: TrendingUp },
  { to: "/lol/$accountSlug/champions", label: "Champions", Icon: Crown },
];

function renderBreadcrumb() {
  return render(
    <MatchesBreadcrumb accountSlug="ahri" matchId="EUW1_1" sections={SECTIONS} />
  );
}

describe("MatchesBreadcrumb", () => {
  it("renders the one-click back link to the matches list", () => {
    renderBreadcrumb();
    const back = screen.getByRole("link", { name: "Matches" });
    expect(back.getAttribute("href")).toBe("/lol/$accountSlug/matches");
  });

  it("exposes a labelled section-switcher trigger", () => {
    renderBreadcrumb();
    // Radix DropdownMenu doesn't open in happy-dom, so the section items live
    // behind the closed trigger — assert the trigger is present + labelled.
    expect(screen.getByRole("button", { name: "Switch section" })).toBeTruthy();
  });

  it("has no axe violations", async () => {
    const { container } = renderBreadcrumb();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
