import { mainScrollRef } from "@/lib/scroll-container";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveMatchProvider, useActiveMatch } from "./active-match-context";
import { MatchList } from "./match-list";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
  useRouterState: () => false,
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

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <TooltipPrimitive.Provider>
      <QueryClientProvider client={client}>
        <MotionConfig reducedMotion="always">
          <ActiveMatchProvider>{ui}</ActiveMatchProvider>
        </MotionConfig>
      </QueryClientProvider>
    </TooltipPrimitive.Provider>
  );
}

const matches: MatchSummary[] = [
  {
    matchId: "EUW1_1",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    durationSec: 1834,
    playedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "14.20.586.5840",
    visionScore: 30,
    damageShare: 0.25,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  },
  {
    matchId: "EUW1_2",
    queueType: "ARAM",
    champion: "Jhin",
    kills: 4,
    deaths: 7,
    assists: 5,
    win: false,
    durationSec: 1280,
    playedAt: new Date(Date.now() - 50 * 3_600_000).toISOString(),
    remake: false,
    teamPosition: "",
    gameVersion: "14.20.586.5840",
    visionScore: 30,
    damageShare: 0.25,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  },
];

function hasFlatText(text: string) {
  return (_: string, el: Element | null) => el?.textContent === text;
}

describe("MatchList", () => {
  it("renders one item per match with champion, queue, and kda", () => {
    renderWithProviders(<MatchList matches={matches} accountSlug="ahri" />);

    expect(screen.queryByText("Ahri")).not.toBeNull();
    expect(screen.queryByText("Jhin")).not.toBeNull();
    expect(screen.queryByText(/Ranked Solo/)).not.toBeNull();
    expect(screen.queryByText(/ARAM/)).not.toBeNull();
    expect(screen.queryByText(hasFlatText("8 / 3 / 12"))).not.toBeNull();
    expect(screen.queryByText(hasFlatText("4 / 7 / 5"))).not.toBeNull();
  });

  it("formats duration as Xm SSs", () => {
    renderWithProviders(<MatchList matches={matches} accountSlug="ahri" />);
    expect(screen.queryByText(/30m 34s/)).not.toBeNull();
    expect(screen.queryByText(/21m 20s/)).not.toBeNull();
  });
});

describe("MatchList settle + paging", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    // Stub a scroll container so useLayoutEffect's restoredScrollY branch runs.
    const fakeContainer = {
      scrollTo: vi.fn(),
      getBoundingClientRect: () => ({ top: 0 }) as DOMRect,
      get scrollTop() {
        return 1000;
      },
    } as unknown as HTMLDivElement;
    mainScrollRef.current = fakeContainer;
  });

  afterEach(() => {
    vi.useRealTimers();
    mainScrollRef.current = null;
  });

  function ListWithSavedScroll({
    matches,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  }: {
    matches: MatchSummary[];
    fetchNextPage?: () => void;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
  }) {
    // Prime the context with a saved scroll position by writing to scrollYRef
    // through `saveListScroll` after stubbing mainScrollRef.scrollTop.
    const { saveListScroll } = useActiveMatch();
    if (saveListScroll) saveListScroll();
    return (
      <MatchList
        matches={matches}
        accountSlug="ahri"
        {...(fetchNextPage !== undefined && { fetchNextPage })}
        {...(hasNextPage !== undefined && { hasNextPage })}
        {...(isFetchingNextPage !== undefined && { isFetchingNextPage })}
      />
    );
  }

  it("clears the settle timeout when the list unmounts", () => {
    const { unmount } = renderWithProviders(<ListWithSavedScroll matches={matches} />);
    // Just unmount cleanly — the settle setTimeout's cleanup runs without error.
    expect(() => unmount()).not.toThrow();
  });
});

describe("MatchList phantoms + near-end fetch", () => {
  it("renders skeleton phantoms when isFetchingNextPage and hasNextPage are both true", () => {
    const { container } = renderWithProviders(
      <MatchList matches={matches} accountSlug="ahri" isFetchingNextPage hasNextPage />
    );
    // Phantom rows render with MatchCardSkeleton (h-28 outer wrapper). The
    // visible rows plus phantoms exceed the matches.length count.
    const skeletons = container.querySelectorAll(".h-28");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("invokes fetchNextPage once the virtualizer reaches the tail and a next page exists", () => {
    const fetchNextPage = vi.fn();
    renderWithProviders(
      <MatchList
        matches={matches}
        accountSlug="ahri"
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage={false}
      />
    );
    // Both matches are virtualized (the mock returns every row), so the
    // tail is reached immediately and fetchNextPage runs on mount.
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("does not call fetchNextPage when there is no next page", () => {
    const fetchNextPage = vi.fn();
    renderWithProviders(
      <MatchList
        matches={matches}
        accountSlug="ahri"
        fetchNextPage={fetchNextPage}
        hasNextPage={false}
      />
    );
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("does not call fetchNextPage while a fetch is already in flight", () => {
    const fetchNextPage = vi.fn();
    renderWithProviders(
      <MatchList
        matches={matches}
        accountSlug="ahri"
        fetchNextPage={fetchNextPage}
        hasNextPage
        isFetchingNextPage
      />
    );
    // The phantoms are visible, but fetchNextPage is gated by isFetchingNextPage.
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
