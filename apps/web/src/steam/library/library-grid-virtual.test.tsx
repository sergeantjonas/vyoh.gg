import { mainScrollRef } from "@/lib/scroll-container";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveGameProvider } from "./active-game-context";
import { LibraryGridVirtual } from "./library-grid-virtual";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/steam/profile-backdrop", () => ({
  prefetchSteamGameBackdrop: vi.fn(),
}));

vi.mock("./library-tile-hovercard", () => ({
  LibraryTileHovercardContent: () => null,
  LIBRARY_HOVERCARD_CONTENT_CLASS: "",
}));

// Mock virtualizer mirrors the row variant + adds `lane` (round-robin
// across the configured lane count) so each tile gets a deterministic
// column index for the positioning assertions below.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
    lanes,
  }: {
    count: number;
    estimateSize: () => number;
    lanes?: number;
    [key: string]: unknown;
  }) => {
    const laneCount = lanes ?? 1;
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, index) => ({
          index,
          start: Math.floor(index / laneCount) * estimateSize(),
          lane: index % laneCount,
          key: index,
        })),
      getTotalSize: () => Math.ceil(count / laneCount) * estimateSize(),
      measureElement: () => undefined,
    };
  },
}));

afterEach(() => {
  mainScrollRef.current = null;
});

function game(overrides: Partial<SteamOwnedGame> = {}): SteamOwnedGame {
  return {
    appid: 440,
    name: "Team Fortress 2",
    playtimeForeverMinutes: 0,
    playtime2WeeksMinutes: 0,
    rtimeLastPlayedAt: null,
    iconHash: null,
    appType: 0,
    assetTimestamp: null,
    tagIds: [],
    recentPlaytimeMinutes: [],
    ...overrides,
  } as unknown as SteamOwnedGame;
}

function renderGrid(games: SteamOwnedGame[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <TooltipPrimitive.Provider>
      <QueryClientProvider client={client}>
        <ActiveGameProvider>
          <LibraryGridVirtual games={games} />
        </ActiveGameProvider>
      </QueryClientProvider>
    </TooltipPrimitive.Provider>
  );
}

describe("LibraryGridVirtual", () => {
  it("renders a tile per game in the visible set", () => {
    renderGrid([
      game({ appid: 1, name: "Alpha" }),
      game({ appid: 2, name: "Beta" }),
      game({ appid: 3, name: "Gamma" }),
    ]);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    expect(screen.getByText("Gamma")).toBeTruthy();
  });

  it("positions each tile absolutely with a per-lane left offset", () => {
    const { container } = renderGrid([
      game({ appid: 1, name: "A" }),
      game({ appid: 2, name: "B" }),
    ]);
    const tiles = container.querySelectorAll("li");
    expect(tiles.length).toBe(2);
    // happy-dom resolves all min-width matchMedia queries as true at the
    // default viewport size, so `useLaneCount` returns 5 here. The first
    // tile sits at lane 0 (left 0%); the second at lane 1, which is one
    // full lane width to the right — assert the offset shape rather than
    // a specific percentage so the test survives breakpoint tweaks.
    expect((tiles[0] as HTMLElement).style.position).toBe("absolute");
    expect((tiles[0] as HTMLElement).style.left).toBe("0%");
    const secondLeft = (tiles[1] as HTMLElement).style.left;
    expect(secondLeft.endsWith("%")).toBe(true);
    expect(Number.parseFloat(secondLeft)).toBeGreaterThan(0);
  });

  it("stamps data-mount-stagger + --i on the first 8 tiles of the initial paint", () => {
    const games = Array.from({ length: 12 }, (_, i) => game({ appid: i + 1 }));
    const { container } = renderGrid(games);
    const tiles = Array.from(container.querySelectorAll("li")) as HTMLElement[];
    expect(tiles.length).toBe(12);
    for (let i = 0; i < 8; i++) {
      const tile = tiles[i] as HTMLElement;
      expect(tile.hasAttribute("data-mount-stagger")).toBe(true);
      expect(tile.style.getPropertyValue("--i")).toBe(String(i));
    }
    for (let i = 8; i < 12; i++) {
      const tile = tiles[i] as HTMLElement;
      expect(tile.hasAttribute("data-mount-stagger")).toBe(false);
      expect(tile.style.getPropertyValue("--i")).toBe("");
    }
  });
});
