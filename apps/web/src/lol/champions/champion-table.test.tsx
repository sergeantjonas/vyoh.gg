import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ChampionStats } from "./champion-stats";
import { ChampionTable } from "./champion-table";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

vi.mock("./use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
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
  return {
    champion: "Ahri",
    position: "MIDDLE",
    games: 10,
    wins: 6,
    losses: 4,
    winRate: 0.6,
    avgKda: 3.2,
    totalDurationSec: 12_000,
    ...overrides,
  } as ChampionStats;
}

function renderTable(ui: ReactNode) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </MotionConfig>
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
});
