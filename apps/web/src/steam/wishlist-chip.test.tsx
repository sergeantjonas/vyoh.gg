import { render, screen } from "@testing-library/react";
import type { SteamWishlist, SteamWishlistItem } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSteamWishlist } from "./use-wishlist";
import { WishlistChip } from "./wishlist-chip";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("./use-wishlist", () => ({
  useSteamWishlist: vi.fn(),
}));

type HookReturn = {
  data: SteamWishlist | undefined;
  isPending: boolean;
  isError: boolean;
};

function mockHook(value: HookReturn): void {
  vi.mocked(useSteamWishlist).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamWishlist>
  );
}

function makeItem(overrides: Partial<SteamWishlistItem> = {}): SteamWishlistItem {
  return {
    appid: 1,
    name: "Test Game",
    dateAdded: 1_577_836_800, // 2020-01-01
    priority: 0,
    storeUrl: "https://store.steampowered.com/app/1",
    releaseDate: null,
    comingSoon: false,
    ...overrides,
  };
}

function renderChip() {
  return render(
    <MotionConfig reducedMotion="always">
      <WishlistChip />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useSteamWishlist).mockReset();
});

describe("WishlistChip", () => {
  it("renders the loading state while pending", () => {
    mockHook({ data: undefined, isPending: true, isError: false });
    renderChip();
    expect(screen.getByText("Loading wishlist…")).toBeTruthy();
  });

  it("renders an unavailable verdict on error", () => {
    mockHook({ data: undefined, isPending: false, isError: true });
    renderChip();
    expect(screen.getByText("Wishlist is unavailable right now.")).toBeTruthy();
  });

  it("renders the empty-wishlist verdict when the items array is empty", () => {
    mockHook({
      data: { steamId: "x", items: [], fetchedAt: 0 },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Nothing on the wishlist right now.")).toBeTruthy();
  });

  it("frames the verdict around the oldest entry by dateAdded (year extracted)", () => {
    mockHook({
      data: {
        steamId: "x",
        items: [
          makeItem({ appid: 2, name: "Newer", dateAdded: 1_700_000_000 }), // 2023
          makeItem({ appid: 3, name: "Oldest", dateAdded: 1_500_000_000 }), // 2017
        ],
        fetchedAt: 0,
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Oldest entry: Oldest (2017).")).toBeTruthy();
  });

  it("falls back to a name-less phrasing when the oldest entry has no name", () => {
    mockHook({
      data: {
        steamId: "x",
        items: [makeItem({ appid: 4, name: null, dateAdded: 1_500_000_000 })],
        fetchedAt: 0,
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Oldest entry has been waiting since 2017.")).toBeTruthy();
  });

  it("caps the evidence preview at PREVIEW_LIMIT (5)", () => {
    const items: SteamWishlistItem[] = Array.from({ length: 8 }, (_, i) =>
      makeItem({
        appid: 100 + i,
        name: `Game ${i + 1}`,
        // Sorted oldest-first → ascending dateAdded.
        dateAdded: 1_500_000_000 + i * 60 * 60 * 24 * 365,
      })
    );
    mockHook({
      data: { steamId: "x", items, fetchedAt: 0 },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Game 1")).toBeTruthy();
    expect(screen.getByText("Game 5")).toBeTruthy();
    expect(screen.queryByText("Game 6")).toBeNull();
  });

  it("falls back to a placeholder label for items with null name in the preview list", () => {
    mockHook({
      data: {
        steamId: "x",
        items: [makeItem({ appid: 42, name: null, dateAdded: 1_500_000_000 })],
        fetchedAt: 0,
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Unknown title (app 42)")).toBeTruthy();
  });
});
