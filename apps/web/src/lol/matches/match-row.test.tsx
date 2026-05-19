import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActiveMatchProvider } from "./active-match-context";
import { MatchRow } from "./match-row";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode }) => (
    <a {...(props as Record<string, string>)}>{children}</a>
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/champions/champion-card", () => ({
  ChampionCardChrome: ({ champion }: { champion: string }) => (
    <div data-testid="chrome" data-champion={champion} />
  ),
  championCardClassName: "champ-card",
  championCardStyle: () => ({}),
}));

vi.mock("@/lol/_shared/ui/card-tilt", () => ({
  CardTilt: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./match-list-row-popover", () => ({
  MatchListRowPopover: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

function summary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "EUW1_42",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 8,
    deaths: 3,
    assists: 12,
    win: true,
    durationSec: 1800,
    // Hard-coded ~5 minutes ago so the "5m ago" verdict is deterministic.
    playedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
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
    ...overrides,
  };
}

function renderRow(props: {
  match: MatchSummary;
  lpDelta?: number;
  isNew?: boolean;
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <ActiveMatchProvider>
        <MatchRow
          match={props.match}
          accountSlug="jonas-euw"
          championDisplayName="Ahri"
          {...(props.lpDelta !== undefined && { lpDelta: props.lpDelta })}
          {...(props.isNew !== undefined && { isNew: props.isNew })}
        />
      </ActiveMatchProvider>
    </MotionConfig>
  );
}

describe("MatchRow", () => {
  it("renders the champion name and Win badge for a winning game", () => {
    renderRow({ match: summary() });
    expect(screen.getByText("Ahri")).toBeTruthy();
    expect(screen.getByText("Win")).toBeTruthy();
  });

  it("renders the Loss badge for a lost game", () => {
    renderRow({ match: summary({ win: false }) });
    expect(screen.getByText("Loss")).toBeTruthy();
    expect(screen.queryByText("Win")).toBeNull();
  });

  it("renders the Remake badge and suppresses LP delta on remakes", () => {
    const { container } = renderRow({ match: summary({ remake: true }), lpDelta: 10 });
    expect(screen.getByText("Remake")).toBeTruthy();
    expect(container.textContent).not.toContain("LP");
  });

  it("renders a positive LP delta with a + prefix", () => {
    const { container } = renderRow({ match: summary(), lpDelta: 22 });
    expect(container.textContent).toContain("+22 LP");
  });

  it("renders the queue type, duration, and 'just now / Xm ago' relative time", () => {
    const { container } = renderRow({ match: summary() });
    expect(container.textContent).toContain("Ranked Solo");
    expect(container.textContent).toContain("30m 00s");
    expect(container.textContent).toMatch(/just now|m ago/);
  });

  it("renders the 'vs <opponent>' line on lane queues with a lane opponent", () => {
    renderRow({
      match: summary({
        teamPosition: "MIDDLE",
        laneOpponent: {
          championName: "Yasuo",
          gameName: "Other",
          tagLine: "EUW",
          puuid: "puuid-y",
          riotIdGameName: "Other",
        } as unknown as MatchSummary["laneOpponent"],
      }),
    });
    expect(screen.getByText(/vs/)).toBeTruthy();
    expect(screen.getByText(/Yasuo/)).toBeTruthy();
  });

  it("omits the 'vs <opponent>' line for ARAM / Arena queues", () => {
    const { container } = renderRow({
      match: summary({
        queueType: "ARAM",
        laneOpponent: {
          championName: "Yasuo",
          gameName: "Other",
          tagLine: "EUW",
          puuid: "puuid-y",
          riotIdGameName: "Other",
        } as unknown as MatchSummary["laneOpponent"],
      }),
    });
    expect(container.textContent).not.toContain("vs Yasuo");
  });
});
