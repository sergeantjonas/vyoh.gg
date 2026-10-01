import { seedViewer } from "@/auth/mock-viewer";
import { mainScrollRef } from "@/lib/scroll-container";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
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

const { measure } = vi.hoisted(() => ({ measure: vi.fn() }));

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
    measure,
  }),
}));

afterEach(() => {
  mainScrollRef.current = null;
  measure.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

function stubListWidth(width: number) {
  vi.spyOn(HTMLUListElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
  } as DOMRect);
}

function renderList(
  games: SteamOwnedGame[],
  { settled = true, width = 848 }: { settled?: boolean; width?: number } = {}
) {
  // happy-dom lays nothing out and answers every min-width query true, so a
  // desktop width keeps the measured tier agreeing with the viewport guess.
  stubListWidth(width);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedViewer(client);
  return render(
    <TooltipPrimitive.Provider>
      <QueryClientProvider client={client}>
        <ActiveGameProvider>
          <LibraryListVirtual games={games} settled={settled} restoredScrollY={0} />
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

  describe("row stride", () => {
    function offsets(container: HTMLElement) {
      return Array.from(container.querySelectorAll("li"), (li) => li.style.transform);
    }

    it("keys the row height on the list's own width rather than the viewport", () => {
      const narrow = renderList([game({ appid: 1 }), game({ appid: 2 })], { width: 400 });
      expect(offsets(narrow.container)).toEqual(["translateY(0px)", "translateY(152px)"]);
      narrow.unmount();

      const wide = renderList([game({ appid: 1 }), game({ appid: 2 })], { width: 848 });
      expect(offsets(wide.container)).toEqual(["translateY(0px)", "translateY(168px)"]);
    });

    it("rebuilds the virtualizer's measurements when a resize crosses the breakpoint", () => {
      let notify: ResizeObserverCallback = () => {};
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(cb: ResizeObserverCallback) {
            notify = cb;
          }
          observe() {}
          disconnect() {}
        }
      );
      const { container } = renderList([game({ appid: 1 }), game({ appid: 2 })], {
        width: 400,
      });
      // The first commit guessed wide from the viewport, so the narrow
      // measurement has already rebuilt once.
      expect(measure).toHaveBeenCalledTimes(1);
      measure.mockClear();

      const resize = (width: number) =>
        act(() =>
          notify(
            [{ contentRect: { width } } as ResizeObserverEntry],
            {} as ResizeObserver
          )
        );
      resize(500);
      expect(measure).not.toHaveBeenCalled();
      resize(700);
      expect(measure).toHaveBeenCalledTimes(1);
      expect(offsets(container)).toEqual(["translateY(0px)", "translateY(168px)"]);
    });
  });
});
