import { fireEvent, render, screen } from "@testing-library/react";
import { configureAxe } from "jest-axe";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WishlistTabs,
  isWishlistTab,
  wishlistPanelId,
  wishlistTabId,
} from "./wishlist-tabs";

vi.mock("@tanstack/react-router", () => ({
  // Strip router-only props (`to`, `search`) so the rest — role, aria-*,
  // tabIndex, id, className — spread onto a plain anchor for assertion.
  Link: ({
    children,
    to,
    search,
    ...props
  }: { children: ReactNode; to?: string; search?: unknown }) => (
    <a href={typeof to === "string" ? to : "#"} {...props}>
      {children}
    </a>
  ),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

function Harness({ active }: { active: "upcoming" | "all" }) {
  return (
    <>
      <WishlistTabs active={active} />
      <div
        role="tabpanel"
        id={wishlistPanelId("upcoming")}
        aria-labelledby={wishlistTabId("upcoming")}
      >
        upcoming
      </div>
      <div
        role="tabpanel"
        id={wishlistPanelId("all")}
        aria-labelledby={wishlistTabId("all")}
      >
        all
      </div>
    </>
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isWishlistTab", () => {
  it("accepts the two known tab ids and rejects anything else", () => {
    expect(isWishlistTab("upcoming")).toBe(true);
    expect(isWishlistTab("all")).toBe(true);
    expect(isWishlistTab("calendar")).toBe(false);
    expect(isWishlistTab(undefined)).toBe(false);
    expect(isWishlistTab(2)).toBe(false);
  });
});

describe("WishlistTabs", () => {
  it("renders a labelled tablist with both views", () => {
    render(<Harness active="all" />);
    const tablist = screen.getByRole("tablist", { name: "Wishlist views" });
    expect(tablist).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Upcoming" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "All" })).toBeTruthy();
  });

  it("marks the active tab selected and controls its panel", () => {
    render(<Harness active="upcoming" />);
    const upcoming = screen.getByRole("tab", { name: "Upcoming" });
    const all = screen.getByRole("tab", { name: "All" });

    expect(upcoming.getAttribute("aria-selected")).toBe("true");
    expect(upcoming.getAttribute("tabindex")).toBe("0");
    expect(upcoming.getAttribute("aria-controls")).toBe(wishlistPanelId("upcoming"));

    expect(all.getAttribute("aria-selected")).toBe("false");
    expect(all.getAttribute("tabindex")).toBe("-1");
  });

  it("each tab deep-links to /steam/wishlist", () => {
    render(<Harness active="all" />);
    for (const name of ["Upcoming", "All"]) {
      expect(screen.getByRole("tab", { name }).getAttribute("href")).toBe(
        "/steam/wishlist"
      );
    }
  });

  it("roves focus across tabs with arrow keys (manual activation)", () => {
    render(<Harness active="upcoming" />);
    const upcoming = screen.getByRole("tab", { name: "Upcoming" });
    const all = screen.getByRole("tab", { name: "All" });
    upcoming.focus();

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(all);

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(upcoming); // wraps around
  });

  it("has no axe violations", async () => {
    const { container } = render(<Harness active="upcoming" />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
