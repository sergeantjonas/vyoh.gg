import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import { ChampionPoolDrift } from "./champion-pool-drift";

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <img alt={championName} />
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

const NOW = new Date("2026-05-13T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;

function fakeMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: `M${Math.random()}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    win: true,
    remake: false,
    playedAt: new Date(NOW - 3 * DAY).toISOString(),
    teamPosition: "MIDDLE",
    ...overrides,
  } as unknown as MatchSummary;
}

function renderDrift(props: {
  matches: MatchSummary[];
  role?: "MIDDLE" | "TOP" | "JUNGLE" | "BOTTOM" | "UTILITY";
}) {
  return render(
    <TooltipPrimitive.Provider>
      <ChampionPoolDrift
        matches={props.matches}
        now={NOW}
        {...(props.role !== undefined && { role: props.role })}
      />
    </TooltipPrimitive.Provider>
  );
}

describe("ChampionPoolDrift (rendered)", () => {
  it("renders 'No games in the last 14 days.' when there is no recent activity", () => {
    renderDrift({ matches: [] });
    expect(screen.getByText(/No games in the last 14 days/)).toBeTruthy();
  });

  it("renders the 'no prior window' verdict when there are recent games but nothing before", () => {
    renderDrift({ matches: [fakeMatch({ champion: "Lux" })] });
    expect(screen.getByText(/no prior window to compare against yet\./)).toBeTruthy();
  });

  it("renders the 'picked up X cooled on Y' verdict when added + dropped both exist", () => {
    renderDrift({
      matches: [
        fakeMatch({ champion: "Lux", playedAt: new Date(NOW - 3 * DAY).toISOString() }),
        fakeMatch({ champion: "Ahri", playedAt: new Date(NOW - 20 * DAY).toISOString() }),
      ],
    });
    expect(
      screen.getByText(/Picked up Lux this fortnight; cooled on Ahri\./)
    ).toBeTruthy();
  });

  it("renders the 'pool widening' verdict for added-only", () => {
    renderDrift({
      matches: [
        fakeMatch({ champion: "Lux", playedAt: new Date(NOW - 3 * DAY).toISOString() }),
        fakeMatch({
          champion: "Soraka",
          playedAt: new Date(NOW - 3 * DAY).toISOString(),
        }),
        fakeMatch({
          champion: "Soraka",
          playedAt: new Date(NOW - 20 * DAY).toISOString(),
        }),
      ],
    });
    expect(screen.getByText(/New this fortnight: Lux\. Pool widening\./)).toBeTruthy();
  });

  it("renders the 'cooled on X' verdict for dropped-only", () => {
    renderDrift({
      matches: [
        fakeMatch({
          champion: "Soraka",
          playedAt: new Date(NOW - 3 * DAY).toISOString(),
        }),
        fakeMatch({
          champion: "Soraka",
          playedAt: new Date(NOW - 20 * DAY).toISOString(),
        }),
        fakeMatch({
          champion: "Yasuo",
          playedAt: new Date(NOW - 20 * DAY).toISOString(),
        }),
      ],
    });
    expect(
      screen.getByText(/Cooled on Yasuo; otherwise same pool as last fortnight\./)
    ).toBeTruthy();
  });

  it("renders the 'same N champions' verdict when added and dropped are both empty", () => {
    renderDrift({
      matches: [
        fakeMatch({ champion: "Ahri", playedAt: new Date(NOW - 3 * DAY).toISOString() }),
        fakeMatch({ champion: "Ahri", playedAt: new Date(NOW - 20 * DAY).toISOString() }),
      ],
    });
    expect(screen.getByText(/Same 1 champion as last fortnight\./)).toBeTruthy();
  });

  it("scopes by role when the role prop is provided", () => {
    renderDrift({
      role: "MIDDLE",
      matches: [
        fakeMatch({
          champion: "Ahri",
          teamPosition: "MIDDLE",
          playedAt: new Date(NOW - 3 * DAY).toISOString(),
        }),
        fakeMatch({
          champion: "Garen",
          teamPosition: "TOP",
          playedAt: new Date(NOW - 3 * DAY).toISOString(),
        }),
      ],
    });
    // ROLE_LABEL["MIDDLE"] is "Mid"
    expect(screen.getByText(/Your.*pool drift/i)).toBeTruthy();
  });
});
