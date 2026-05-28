import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalettePreviewMatch } from "./command-palette-preview-match";

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-testid={`champ-icon-${championName}`} />
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => (alias === "JarvanIV" ? "Jarvan IV" : alias),
}));

function buildMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "EUW1_1234",
    queueType: "Ranked Solo",
    champion: "Jinx",
    kills: 8,
    deaths: 4,
    assists: 12,
    win: true,
    durationSec: 1860,
    playedAt: new Date().toISOString(),
    remake: false,
    teamPosition: "BOTTOM",
    gameVersion: "14.10",
    visionScore: 30,
    damageShare: 0.32,
    firstBloodKill: false,
    csAt10: 80,
    csAt15: 120,
    goldAt10: 4000,
    goldAt15: 6000,
    teamGoldDiffAt15: 500,
    teamGoldDiffSeries: [],
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CommandPalettePreviewMatch", () => {
  it("renders KDA, queue, duration, and the champion's display name", () => {
    render(<CommandPalettePreviewMatch match={buildMatch({ champion: "JarvanIV" })} />);
    const preview = screen.getByTestId("command-palette-preview");
    expect(preview.textContent).toContain("Jarvan IV");
    expect(preview.textContent).toContain("Ranked Solo");
    expect(preview.textContent).toContain("8/4/12");
    expect(preview.textContent).toContain("31m 00s");
  });

  it("shows a Win chip for wins", () => {
    render(<CommandPalettePreviewMatch match={buildMatch({ win: true })} />);
    expect(screen.getByTestId("match-outcome").textContent).toBe("Win");
  });

  it("shows a Loss chip for losses", () => {
    render(<CommandPalettePreviewMatch match={buildMatch({ win: false })} />);
    expect(screen.getByTestId("match-outcome").textContent).toBe("Loss");
  });

  it("renders KDA as kills+assists when there are no deaths (perfect game)", () => {
    render(
      <CommandPalettePreviewMatch
        match={buildMatch({ kills: 10, deaths: 0, assists: 5 })}
      />
    );
    const preview = screen.getByTestId("command-palette-preview");
    expect(preview.textContent).toContain("15.00 KDA");
  });

  it("tags preview with type for dispatch identification", () => {
    render(<CommandPalettePreviewMatch match={buildMatch()} />);
    expect(
      screen.getByTestId("command-palette-preview").getAttribute("data-preview-type")
    ).toBe("match");
  });
});
