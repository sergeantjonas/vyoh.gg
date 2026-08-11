import { render, screen } from "@testing-library/react";
import type { SteamUpcomingItem, SteamWishlist, SteamWishlistItem } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSteamUpcoming } from "./use-upcoming";
import { useSteamWishlist } from "./use-wishlist";
import { WishlistChip } from "./wishlist-chip";

// `search` is an object, so React drops it off a plain <a>. Serialize it instead —
// which target a deep-link points at is a behaviour worth asserting.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    search,
    ...props
  }: {
    children: ReactNode;
    search?: unknown;
  }) => (
    <a {...props} data-search={search === undefined ? undefined : JSON.stringify(search)}>
      {children}
    </a>
  ),
}));

vi.mock("./use-wishlist", () => ({
  useSteamWishlist: vi.fn(),
}));

vi.mock("./use-upcoming", () => ({
  useSteamUpcoming: vi.fn(),
}));

type HookReturn = {
  data: SteamWishlist | undefined;
  isPending: boolean;
  isError: boolean;
};

// The card reads two queries: the wishlist for its count and fallback list, the
// upcoming set for its leading fact. Server-side the second is the first's
// coming-soon rows plus owned pre-orders, so mirror that by default and let a test
// pass `upcomingItems` when it needs the two to diverge — which is the pre-order
// case, the one shape the wishlist provably cannot hold.
function mockHook(value: HookReturn, upcomingItems?: SteamUpcomingItem[]): void {
  vi.mocked(useSteamWishlist).mockReturnValue(
    value as unknown as ReturnType<typeof useSteamWishlist>
  );
  const items =
    upcomingItems ??
    (value.data?.items ?? []).filter((item) => item.comingSoon).map(asUpcoming);
  vi.mocked(useSteamUpcoming).mockReturnValue({
    data: { steamId: "x", items, fetchedAt: 0 },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSteamUpcoming>);
}

function asUpcoming(item: SteamWishlistItem): SteamUpcomingItem {
  const { priority: _priority, ...rest } = item;
  return { ...rest, source: "wishlist" };
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
  vi.mocked(useSteamUpcoming).mockReset();
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

  it("leads with a forward-looking 'next up' verdict for a near dated release", () => {
    // Fake only Date so the chip's `useMemo(() => new Date())` reads a fixed
    // today; leave rAF/timers real for Motion.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    try {
      mockHook({
        data: {
          steamId: "x",
          items: [
            makeItem({
              appid: 10,
              name: "Soon",
              comingSoon: true,
              releaseDate: Math.floor(Date.UTC(2026, 0, 25, 12, 0, 0) / 1000), // +10d
            }),
          ],
          fetchedAt: 0,
        },
        isPending: false,
        isError: false,
      });
      renderChip();
      expect(screen.getByText("Next up: Soon, in 10 days.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("frames a TBA-only wishlist as still-waiting on the oldest entry", () => {
    mockHook({
      data: {
        steamId: "x",
        items: [
          makeItem({
            appid: 20,
            name: "Newer TBA",
            comingSoon: true,
            dateAdded: 1_700_000_000,
          }),
          makeItem({
            appid: 21,
            name: "Oldest TBA",
            comingSoon: true,
            dateAdded: 1_400_000_000,
          }),
        ],
        fetchedAt: 0,
      },
      isPending: false,
      isError: false,
    });
    renderChip();
    expect(screen.getByText("Still waiting on Oldest TBA.")).toBeTruthy();
  });

  // The reported bug, on this surface: a pre-ordered game is deleted from the
  // wishlist, so a wishlist-sourced fact names the second-nearest release. The
  // upcoming query is the only place the nearer one still exists.
  it("names a pre-ordered release the wishlist no longer holds", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    try {
      mockHook(
        {
          data: {
            steamId: "x",
            items: [
              makeItem({
                appid: 30,
                name: "Wishlisted",
                comingSoon: true,
                releaseDate: Math.floor(Date.UTC(2026, 0, 30, 12) / 1000), // +15d
              }),
            ],
            fetchedAt: 0,
          },
          isPending: false,
          isError: false,
        },
        [
          {
            appid: 31,
            name: "Pre-ordered",
            storeUrl: "https://store.steampowered.com/app/31/",
            releaseDate: Math.floor(Date.UTC(2026, 0, 20, 12) / 1000), // +5d, nearer
            comingSoon: true,
            dateAdded: 1_700_000_000,
            source: "owned",
          },
        ]
      );
      renderChip();
      expect(screen.getByText("Next up: Pre-ordered, in 5 days.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  // The fact is a release-date claim, so its evidence belongs on the timeline
  // whichever provenance it came from — and `?appid`, which scrolls the list to a
  // wishlist row, has nothing to scroll to when the title was bought.
  it("sends the fact's evidence to the calendar rather than a list row", () => {
    const upcomingLike = {
      storeUrl: "https://store.steampowered.com/app/31/",
      releaseDate: null,
      comingSoon: true,
      dateAdded: 1_700_000_000,
    } as const;

    for (const source of ["wishlist", "owned"] as const) {
      mockHook(
        {
          data: { steamId: "x", items: [makeItem({ appid: 30 })], fetchedAt: 0 },
          isPending: false,
          isError: false,
        },
        [{ ...upcomingLike, appid: 31, name: "Next thing", source }]
      );
      const { container } = renderChip();
      const links = [...container.querySelectorAll("a")];

      expect(links.map((a) => a.getAttribute("to"))).toContain("/steam/upcoming");
      expect(links.some((a) => a.getAttribute("data-search")?.includes("appid"))).toBe(
        false
      );
    }
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
