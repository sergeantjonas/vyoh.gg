import { mainScrollRef } from "@/lib/scroll-container";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { SteamOwnedGame } from "@vyoh/shared";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActiveGameProvider } from "./active-game-context";
import { LibraryListVirtual } from "./library-list-virtual";

// Same pattern as match-list.test.tsx: stub the router primitives the row
// pulls in, and replace the virtualizer with a synchronous all-items
// generator so each assertion sees the full game set without touching
// the real intersection / measurement plumbing.
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

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
    [key: string]: unknown;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(),
        key: index,
      })),
    getTotalSize: () => count * estimateSize(),
    measureElement: () => undefined,
  }),
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
    ...overrides,
  } as unknown as SteamOwnedGame;
}

function renderList(
  games: SteamOwnedGame[],
  { settled = true }: { settled?: boolean } = {}
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <TooltipPrimitive.Provider>
      <QueryClientProvider client={client}>
        <ActiveGameProvider>
          <LibraryListVirtual games={games} settled={settled} />
        </ActiveGameProvider>
      </QueryClientProvider>
    </TooltipPrimitive.Provider>
  );
}

describe("LibraryListVirtual", () => {
  it("renders a row per game in the visible set", () => {
    renderList([
      game({ appid: 1, name: "Alpha" }),
      game({ appid: 2, name: "Beta" }),
      game({ appid: 3, name: "Gamma" }),
    ]);
    // The row shell uses the title-logo image as the visible wordmark and
    // only falls back to text on logo-load failure — so the name is in
    // the logo's `alt` (not in visible text) during a happy-dom render
    // where no actual asset fetch happens.
    expect(screen.getByAltText("Alpha")).toBeTruthy();
    expect(screen.getByAltText("Beta")).toBeTruthy();
    expect(screen.getByAltText("Gamma")).toBeTruthy();
  });

  it("renders an empty <ul> when there are no games", () => {
    const { container } = renderList([]);
    const ul = container.querySelector("ul");
    expect(ul).not.toBeNull();
    expect(ul?.querySelectorAll("li").length).toBe(0);
  });

  it("applies absolute positioning to each row so the virtualizer owns layout", () => {
    const { container } = renderList([game({ appid: 1 }), game({ appid: 2 })]);
    const rows = container.querySelectorAll("li");
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect((row as HTMLElement).style.position).toBe("absolute");
    }
  });

  it("stamps data-mount-stagger + --i on the first 8 rows of the initial paint", () => {
    const games = Array.from({ length: 12 }, (_, i) => game({ appid: i + 1 }));
    const { container } = renderList(games);
    const rows = Array.from(container.querySelectorAll("li")) as HTMLElement[];
    expect(rows.length).toBe(12);
    for (let i = 0; i < 8; i++) {
      const row = rows[i] as HTMLElement;
      expect(row.hasAttribute("data-mount-stagger")).toBe(true);
      expect(row.style.getPropertyValue("--i")).toBe(String(i));
    }
    for (let i = 8; i < 12; i++) {
      const row = rows[i] as HTMLElement;
      expect(row.hasAttribute("data-mount-stagger")).toBe(false);
      expect(row.style.getPropertyValue("--i")).toBe("");
    }
  });

  it("skips the cascade during back-nav settle so it doesn't fight the morph", () => {
    const { container } = renderList([game({ appid: 1 }), game({ appid: 2 })], {
      settled: false,
    });
    const rows = Array.from(container.querySelectorAll("li")) as HTMLElement[];
    for (const row of rows) {
      expect(row.hasAttribute("data-mount-stagger")).toBe(false);
      expect(row.style.getPropertyValue("--i")).toBe("");
    }
  });
});
