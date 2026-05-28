import { mainScrollRef } from "@/lib/scroll-container";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveChampionProvider, useActiveChampion } from "./active-champion-context";
import type { ChampionStats } from "./champion-stats";
import { ChampionTable } from "./champion-table";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: () => ({ region: "EUW1", gameName: "X", tagLine: "EUW" }),
}));

vi.mock("./use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
  useChampions: () => ({
    data: new Map([
      [
        "ahri",
        {
          id: 103,
          alias: "Ahri",
          name: "Ahri",
          roles: ["Mage"],
          modernClasses: ["Mage"],
          // API stores subclasses lowercase ("burst", "enchanter"); the row
          // capitalises at render so visual hierarchy reads "Mage · Burst".
          modernSubclasses: ["burst"],
        },
      ],
    ]),
  }),
}));

vi.mock("@/lol/_shared/ui/card-tilt", () => ({
  CardTilt: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lol/champions/champion-card", () => ({
  championCardClassName: "card-class",
  championCardStyle: () => ({}),
  ChampionCardChrome: ({ champion }: { champion: string }) => (
    <div data-testid="chrome">{champion}</div>
  ),
}));

function stat(overrides: Partial<ChampionStats> = {}): ChampionStats {
  const champion = overrides.champion ?? "Ahri";
  const position = overrides.position ?? "MIDDLE";
  const games = overrides.games ?? 10;
  const wins = overrides.wins ?? 6;
  return {
    champion,
    position,
    games,
    wins,
    losses: overrides.losses ?? games - wins,
    winRate: overrides.winRate ?? wins / games,
    totalKills: overrides.totalKills ?? 0,
    totalDeaths: overrides.totalDeaths ?? 0,
    totalAssists: overrides.totalAssists ?? 0,
    avgKda: overrides.avgKda ?? 3.2,
    totalDurationSec: overrides.totalDurationSec ?? 12_000,
    roles: overrides.roles ?? [
      {
        position,
        games,
        wins,
        losses: overrides.losses ?? games - wins,
        winRate: overrides.winRate ?? wins / games,
      },
    ],
    recentWinRates: overrides.recentWinRates ?? [],
  };
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderTable(ui: ReactNode, queryClient: QueryClient = newQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="always">
        <TooltipPrimitive.Provider>
          <ActiveChampionProvider>{ui}</ActiveChampionProvider>
        </TooltipPrimitive.Provider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

describe("ChampionTable", () => {
  it("renders one row per stats entry with WR / KDA / games", () => {
    renderTable(<ChampionTable stats={[stat()]} sort="games" accountSlug="ahri" />);
    expect(screen.getByTestId("chrome").textContent).toBe("Ahri");
    expect(screen.getAllByText(/Ahri/).length).toBeGreaterThan(0);
    expect(screen.getByText(/WR/)).toBeTruthy();
    expect(screen.getByText(/KDA/)).toBeTruthy();
    expect(screen.getByText(/10 games/)).toBeTruthy();
  });

  it("capitalises lowercase subclass labels (mirrors the detail-page hero)", () => {
    renderTable(<ChampionTable stats={[stat()]} sort="games" accountSlug="ahri" />);
    expect(screen.getByText(/Burst/)).toBeTruthy();
  });

  it("uses 'game' (singular) when games count is 1", () => {
    renderTable(
      <ChampionTable
        stats={[stat({ games: 1, wins: 1, losses: 0, winRate: 1 })]}
        sort="games"
        accountSlug="ahri"
      />
    );
    expect(screen.getByText(/1 game/)).toBeTruthy();
  });

  it("sorts by winRate descending when sort='winRate'", () => {
    const items = [
      stat({ champion: "Lo", winRate: 0.4 }),
      stat({ champion: "Hi", winRate: 0.8 }),
    ];
    renderTable(<ChampionTable stats={items} sort="winRate" accountSlug="ahri" />);
    const chrome = screen.getAllByTestId("chrome").map((el) => el.textContent);
    expect(chrome).toEqual(["Hi", "Lo"]);
  });

  it("sorts by avgKda descending when sort='avgKda'", () => {
    const items = [
      stat({ champion: "Lo", avgKda: 1.1 }),
      stat({ champion: "Hi", avgKda: 4.5 }),
    ];
    renderTable(<ChampionTable stats={items} sort="avgKda" accountSlug="ahri" />);
    const chrome = screen.getAllByTestId("chrome").map((el) => el.textContent);
    expect(chrome).toEqual(["Hi", "Lo"]);
  });

  it("sorts by playtime descending when sort='playtime'", () => {
    const items = [
      stat({ champion: "Short", totalDurationSec: 60 }),
      stat({ champion: "Long", totalDurationSec: 7200 }),
    ];
    renderTable(<ChampionTable stats={items} sort="playtime" accountSlug="ahri" />);
    const chrome = screen.getAllByTestId("chrome").map((el) => el.textContent);
    expect(chrome).toEqual(["Long", "Short"]);
  });

  it("stamps `champion-${alias}` as view-transition-name on the row li so sort/role reorders pair OLD↔NEW", () => {
    const { container } = renderTable(
      <ChampionTable stats={[stat()]} sort="games" accountSlug="ahri" />
    );
    const li = container.querySelector("li");
    if (!li) throw new Error("li missing");
    expect(li.style.viewTransitionName).toBe("champion-Ahri");
  });

  it("invokes onCardHover with the champion key when the row is hovered", () => {
    const onCardHover = vi.fn();
    renderTable(
      <ChampionTable
        stats={[stat()]}
        sort="games"
        accountSlug="ahri"
        onCardHover={onCardHover}
      />
    );
    const link = screen.getByTestId("chrome").closest("a");
    if (!link) throw new Error("expected a link wrapping the chrome");
    fireEvent.mouseEnter(link);
    expect(onCardHover).toHaveBeenCalledWith("Ahri");
  });

  it("formats playtime in minutes when under 1h", () => {
    renderTable(
      <ChampionTable
        stats={[stat({ totalDurationSec: 900 })]}
        sort="playtime"
        accountSlug="ahri"
      />
    );
    expect(screen.getByText(/· 15m$/)).toBeTruthy();
  });

  it("formats playtime in hours when ≥1h", () => {
    renderTable(
      <ChampionTable
        stats={[stat({ totalDurationSec: 7200 })]}
        sort="playtime"
        accountSlug="ahri"
      />
    );
    expect(screen.getByText(/· 2\.0h$/)).toBeTruthy();
  });

  describe("forward-nav capture (pointerDown on card)", () => {
    beforeEach(() => {
      mainScrollRef.current = null;
    });
    afterEach(() => {
      mainScrollRef.current = null;
    });

    function ProbeConsumer() {
      const { activeChampion, originRectRef, readListScroll } = useActiveChampion();
      return (
        <div
          data-testid="probe"
          data-active={activeChampion ?? ""}
          data-origin-alias={originRectRef.current?.championAlias ?? ""}
          data-origin-direction={originRectRef.current?.direction ?? ""}
          data-scroll={readListScroll()}
        />
      );
    }

    function renderWithProbe(stats: ChampionStats[]) {
      return render(
        <QueryClientProvider client={newQueryClient()}>
          <MotionConfig reducedMotion="always">
            <TooltipPrimitive.Provider>
              <ActiveChampionProvider>
                <ChampionTable stats={stats} sort="games" accountSlug="ahri" />
                <ProbeConsumer />
              </ActiveChampionProvider>
            </TooltipPrimitive.Provider>
          </MotionConfig>
        </QueryClientProvider>
      );
    }

    it("captures scroll + origin rect + active champion on the primary row", () => {
      mainScrollRef.current = { scrollTop: 321 } as HTMLElement;
      renderWithProbe([stat()]);
      const link = screen.getByTestId("chrome").closest("a");
      if (!link) throw new Error("expected a link wrapping the chrome");
      fireEvent.pointerDown(link);
      const probe = screen.getByTestId("probe");
      expect(probe.getAttribute("data-active")).toBe("Ahri");
      expect(probe.getAttribute("data-origin-alias")).toBe("Ahri");
      expect(probe.getAttribute("data-origin-direction")).toBe("forward");
      expect(probe.getAttribute("data-scroll")).toBe("321");
    });

    it("restores the saved list scroll on mount when returning from the detail page", () => {
      const scrollTo = vi.fn();
      mainScrollRef.current = {
        scrollTo,
        get scrollTop() {
          return 540;
        },
      } as unknown as HTMLElement;

      function TableWithSavedScroll({ stats }: { stats: ChampionStats[] }) {
        // Prime the saved scroll via context before the table mounts as a
        // sibling — mirrors the production back-nav path where the row's
        // pointerDown handler saved scroll on the previous visit.
        const { saveListScroll } = useActiveChampion();
        saveListScroll();
        return <ChampionTable stats={stats} sort="games" accountSlug="ahri" />;
      }

      render(
        <QueryClientProvider client={newQueryClient()}>
          <MotionConfig reducedMotion="always">
            <TooltipPrimitive.Provider>
              <ActiveChampionProvider>
                <TableWithSavedScroll stats={[stat()]} />
              </ActiveChampionProvider>
            </TooltipPrimitive.Provider>
          </MotionConfig>
        </QueryClientProvider>
      );

      // The didInitialScrollRef branch (sync scrollTo during render) plus the
      // useLayoutEffect branch (async pin loop) each schedule a scrollTo —
      // both target (0, 540), which is what matters for the parity check.
      expect(scrollTo).toHaveBeenCalledWith(0, 540);
    });

    it("renders a single row per champion even when the champion is played in multiple roles", () => {
      // A champion played in MIDDLE + TOP is consolidated into one stats row
      // (with `roles` carrying the breakdown). The list should render exactly
      // one row for that champion — the detail page is role-agnostic, so two
      // rows would link to the same target.
      renderWithProbe([
        stat({
          champion: "Ahri",
          position: "MIDDLE",
          games: 25,
          roles: [
            { position: "MIDDLE", games: 20, wins: 12, losses: 8, winRate: 0.6 },
            { position: "TOP", games: 5, wins: 2, losses: 3, winRate: 0.4 },
          ],
        }),
      ]);
      const chromes = screen.getAllByTestId("chrome");
      expect(chromes).toHaveLength(1);
    });
  });

  describe("view-transition wiring", () => {
    afterEach(() => {
      const doc = document as unknown as { startViewTransition?: unknown };
      doc.startViewTransition = undefined;
    });

    it("clears every list-item view-transition-name before OLD-snapshot capture so off-screen rows don't paint above the navbar", () => {
      const startVT = vi.fn();
      (document as unknown as { startViewTransition?: unknown }).startViewTransition =
        startVT;

      const { container } = renderTable(
        <ChampionTable
          stats={[stat({ champion: "Janna" }), stat({ champion: "Seraphine" })]}
          sort="games"
          accountSlug="ahri"
        />
      );
      const lis = Array.from(container.querySelectorAll("li")) as HTMLLIElement[];
      const [janna, seraphine] = lis;
      if (!janna || !seraphine) throw new Error("expected two list rows");
      expect(janna.style.viewTransitionName).toBe("champion-Janna");
      expect(seraphine.style.viewTransitionName).toBe("champion-Seraphine");

      // The clicked row carries its click-time name on the inner card, not
      // the li — capture both at OLD-snapshot time (synchronous with the
      // startViewTransition call).
      const snapshot: {
        liNames: string[];
        clickedCardName: string | undefined;
      } = { liNames: [], clickedCardName: undefined };
      startVT.mockImplementation((cb: () => Promise<void> | void) => {
        snapshot.liNames = lis.map((li) => li.style.viewTransitionName);
        snapshot.clickedCardName = (
          seraphine.querySelector("a > div") as HTMLElement | null
        )?.style.viewTransitionName;
        return Promise.resolve(cb());
      });

      const seraphineLink = seraphine.querySelector("a");
      if (!seraphineLink) throw new Error("expected an anchor in the Seraphine row");
      fireEvent.click(seraphineLink, { button: 0 });

      expect(startVT).toHaveBeenCalledTimes(1);
      // Both lis cleared so each row collapses into the root group's
      // single fade instead of getting its own ::view-transition-old pseudo
      // painted over the navbar.
      expect(snapshot.liNames).toEqual(["", ""]);
      // The clicked row's inner card carries the paired morph name.
      expect(snapshot.clickedCardName).toBe("champion-Seraphine-MIDDLE");
    });
  });

  describe("hover prefetch", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("prefetches champion-extras 150ms after pointer enter", () => {
      const qc = newQueryClient();
      const spy = vi
        .spyOn(qc, "prefetchQuery")
        .mockImplementation(() => Promise.resolve());
      renderTable(<ChampionTable stats={[stat()]} sort="games" accountSlug="ahri" />, qc);
      const link = screen.getByTestId("chrome").closest("a");
      if (!link) throw new Error("expected a link wrapping the chrome");
      fireEvent.pointerEnter(link);
      vi.advanceTimersByTime(149);
      expect(spy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]?.queryKey).toEqual([
        "lol",
        "champion-extras",
        "EUW1",
        "X",
        "EUW",
        "Ahri",
      ]);
    });

    it("does not prefetch if the pointer leaves before 150ms", () => {
      const qc = newQueryClient();
      const spy = vi
        .spyOn(qc, "prefetchQuery")
        .mockImplementation(() => Promise.resolve());
      renderTable(<ChampionTable stats={[stat()]} sort="games" accountSlug="ahri" />, qc);
      const link = screen.getByTestId("chrome").closest("a");
      if (!link) throw new Error("expected a link wrapping the chrome");
      fireEvent.pointerEnter(link);
      vi.advanceTimersByTime(100);
      fireEvent.pointerLeave(link);
      vi.advanceTimersByTime(500);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
