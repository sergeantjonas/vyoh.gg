import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { SteamWishlist, SteamWishlistItem } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WishlistUpcomingPanel } from "./wishlist-upcoming-panel";

const { mockUseWishlist } = vi.hoisted(() => ({ mockUseWishlist: vi.fn() }));
vi.mock("@/steam/use-wishlist", () => ({ useSteamWishlist: mockUseWishlist }));

function item(overrides: Partial<SteamWishlistItem>): SteamWishlistItem {
  return {
    appid: 1,
    name: "Game 1",
    dateAdded: 1_700_000_000,
    priority: 0,
    storeUrl: "https://store.steampowered.com/app/1",
    releaseDate: null,
    comingSoon: true,
    ...overrides,
  };
}

function wishlist(items: SteamWishlistItem[]): SteamWishlist {
  return { steamId: "1", items, fetchedAt: 1_700_000_000 };
}

function renderPanel() {
  return render(
    <TooltipPrimitive.Provider>
      <WishlistUpcomingPanel />
    </TooltipPrimitive.Provider>
  );
}

afterEach(() => {
  mockUseWishlist.mockReset();
  document.body.innerHTML = "";
});

describe("WishlistUpcomingPanel", () => {
  it("renders the calendar/band skeleton while pending", () => {
    mockUseWishlist.mockReturnValue({ data: undefined, isPending: true, isError: false });
    const { container } = renderPanel();
    expect(container.querySelector(".animate-shimmer")).toBeTruthy();
  });

  it("renders an error message on failure", () => {
    mockUseWishlist.mockReturnValue({ data: undefined, isPending: false, isError: true });
    renderPanel();
    expect(screen.getByText(/unavailable right now/)).toBeTruthy();
  });

  it("shows the empty state when nothing is upcoming", () => {
    // Only already-released titles → every bucket is empty.
    mockUseWishlist.mockReturnValue({
      data: wishlist([item({ comingSoon: false, releaseDate: 1_600_000_000 })]),
      isPending: false,
      isError: false,
    });
    renderPanel();
    expect(screen.getByText("Nothing on the horizon")).toBeTruthy();
  });

  it("renders bands without a calendar when there are no day-precise releases", () => {
    mockUseWishlist.mockReturnValue({
      data: wishlist([item({ appid: 1, releaseDate: null })]), // TBA only
      isPending: false,
      isError: false,
    });
    renderPanel();
    expect(screen.getByRole("heading", { name: "Still TBA" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Game 1" })).toBeTruthy();
    // Sparse-state gate: no calendar means no month-nav controls.
    expect(screen.queryByLabelText("Previous month")).toBeNull();
  });
});
