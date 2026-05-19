import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchRecapTab, MatchTimelineTab, MatchYourGameTab } from "./match-detail-view";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/lol/_shared/assets/item-icon", () => ({
  ItemIcon: () => <span data-testid="item-icon" />,
}));

vi.mock("@/lol/_shared/assets/keystone-icon", () => ({
  KeystoneIcon: () => <span data-testid="keystone" />,
}));

vi.mock("@/lol/_shared/assets/summoner-spell-icon", () => ({
  SummonerSpellIcon: () => <span data-testid="summ-spell" />,
}));

vi.mock("@/lol/matches/use-items", () => ({
  useItems: () => ({ data: undefined }),
}));

vi.mock("@/lol/matches/use-match-timeline", () => ({
  useMatchTimeline: () => ({ isPending: false, isError: true }),
}));

vi.mock("@/lol/matches/match-build-order", () => ({
  MatchBuildOrder: () => <div data-testid="build-order">build-order</div>,
}));

vi.mock("@/lol/matches/match-skill-order", () => ({
  MatchSkillOrder: () => <div data-testid="skill-order">skill-order</div>,
}));

vi.mock("@/lol/matches/match-lane-phase", () => ({
  MatchLanePhase: () => <div data-testid="lane-phase">lane-phase</div>,
}));

vi.mock("@/lol/matches/match-gold-lead", () => ({
  MatchGoldLead: () => <div data-testid="gold-lead">gold-lead</div>,
}));

vi.mock("@/lol/matches/match-event-timelines", () => ({
  MatchEventTimelines: () => <div data-testid="event-timelines">event-timelines</div>,
}));

vi.mock("@/lol/matches/use-scrollspy", () => ({
  useScrollspy: () => ({
    activeId: "build-order",
    refFor: () => () => {},
    navigateTo: () => {},
  }),
}));

function participant(overrides: Record<string, unknown> = {}): unknown {
  return {
    puuid: `P${Math.random()}`,
    teamId: 100,
    championName: "Ahri",
    kills: 5,
    deaths: 4,
    assists: 8,
    totalDamage: 20000,
    goldEarned: 12000,
    visionScore: 25,
    kp: 0.5,
    csTotal: 200,
    items: [3001, 0, 0, 0, 0, 0, 0],
    keystoneId: 8200,
    summonerSpell1Id: 4,
    summonerSpell2Id: 12,
    teamPosition: "MIDDLE",
    ...overrides,
  };
}

function team(teamId: number, win: boolean, totalGold: number, kills: number): unknown {
  return {
    teamId,
    win,
    totalKills: kills,
    totalGold,
    objectives: {
      baron: { first: false, kills: 0 },
      champion: { first: false, kills },
      dragon: { first: false, kills: 0 },
      inhibitor: { first: false, kills: 0 },
      riftHerald: { first: false, kills: 0 },
      tower: { first: false, kills: 0 },
    },
  };
}

function buildDetail(): MatchDetail {
  return {
    matchId: "EUW1_1",
    queueType: "Ranked Solo",
    durationSec: 1800,
    playedAt: "2026-05-19T10:00:00Z",
    teams: [team(100, true, 60000, 20), team(200, false, 50000, 12)],
    participants: [
      participant({ puuid: "PA", teamId: 100 }),
      participant({ puuid: "PB", teamId: 100, championName: "Lux" }),
      participant({ puuid: "PC", teamId: 200, championName: "Yasuo" }),
      participant({ puuid: "PD", teamId: 200, championName: "Soraka" }),
    ],
  } as unknown as MatchDetail;
}

function renderShell(ui: ReactNode) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>{ui}</TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MatchRecapTab", () => {
  it("renders one team block per side", () => {
    const detail = buildDetail();
    renderShell(<MatchRecapTab detail={detail} myPuuid="PA" accountSlug="me" />);
    expect(screen.getByText("Blue side")).toBeTruthy();
    expect(screen.getByText("Red side")).toBeTruthy();
  });

  it("works without a myPuuid (no highlight)", () => {
    const detail = buildDetail();
    const { container } = renderShell(<MatchRecapTab detail={detail} accountSlug="me" />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe("MatchYourGameTab", () => {
  it("renders the three section blocks", () => {
    const detail = buildDetail();
    renderShell(<MatchYourGameTab detail={detail} myPuuid="PA" />);
    expect(screen.getByTestId("build-order")).toBeTruthy();
    expect(screen.getByTestId("skill-order")).toBeTruthy();
    expect(screen.getByTestId("lane-phase")).toBeTruthy();
  });
});

describe("MatchTimelineTab", () => {
  it("renders gold-lead and event-timelines blocks", () => {
    const detail = buildDetail();
    renderShell(<MatchTimelineTab detail={detail} myPuuid="PA" />);
    expect(screen.getByTestId("gold-lead")).toBeTruthy();
    expect(screen.getByTestId("event-timelines")).toBeTruthy();
  });
});

describe("MatchRecapTab badges", () => {
  it("renders every category badge label when each metric has a distinct winner", () => {
    const detail = {
      matchId: "EUW1_BADGES",
      queueType: "Ranked Solo",
      durationSec: 1800,
      playedAt: "2026-05-19T10:00:00Z",
      teams: [team(100, true, 60000, 20), team(200, false, 50000, 12)],
      participants: [
        participant({ puuid: "P_DMG", teamId: 100, totalDamage: 80000 }),
        participant({
          puuid: "P_KDA",
          teamId: 100,
          kills: 20,
          deaths: 1,
          assists: 15,
          totalDamage: 10000,
        }),
        participant({ puuid: "P_VIS", teamId: 100, visionScore: 90, totalDamage: 5000 }),
        participant({ puuid: "P_KP", teamId: 100, kp: 0.92, totalDamage: 4000 }),
        participant({ puuid: "P_CS", teamId: 200, csTotal: 320, totalDamage: 3000 }),
        participant({ puuid: "P_FEW", teamId: 200, deaths: 0, totalDamage: 2000 }),
        participant({ puuid: "P_PLAIN", teamId: 200, totalDamage: 1000 }),
        participant({ puuid: "P_X", teamId: 200, totalDamage: 500 }),
      ],
    } as unknown as MatchDetail;
    renderShell(<MatchRecapTab detail={detail} accountSlug="me" />);
    // Each distinct winner produces its own badge label in the recap.
    expect(screen.getByText("Top DMG")).toBeTruthy();
    expect(screen.getByText("Top KDA")).toBeTruthy();
    expect(screen.getByText("Top Vision")).toBeTruthy();
    expect(screen.getByText("Top KP")).toBeTruthy();
    expect(screen.getByText("Top CS")).toBeTruthy();
    expect(screen.getByText("Low Deaths")).toBeTruthy();
  });

  it("renders First Blood + First Tower chips for whichever team claimed them", () => {
    const detail = {
      matchId: "EUW1_FB",
      queueType: "Ranked Solo",
      durationSec: 1800,
      playedAt: "2026-05-19T10:00:00Z",
      teams: [
        {
          teamId: 100,
          win: true,
          totalKills: 12,
          totalGold: 50000,
          objectives: {
            baron: { first: false, kills: 0 },
            champion: { first: true, kills: 12 },
            dragon: { first: false, kills: 0 },
            inhibitor: { first: false, kills: 0 },
            riftHerald: { first: false, kills: 0 },
            tower: { first: true, kills: 5 },
          },
        },
        {
          teamId: 200,
          win: false,
          totalKills: 6,
          totalGold: 40000,
          objectives: {
            baron: { first: false, kills: 0 },
            champion: { first: false, kills: 6 },
            dragon: { first: false, kills: 0 },
            inhibitor: { first: false, kills: 0 },
            riftHerald: { first: false, kills: 0 },
            tower: { first: false, kills: 0 },
          },
        },
      ],
      participants: [
        participant({ puuid: "P1", teamId: 100 }),
        participant({ puuid: "P2", teamId: 200 }),
      ],
    } as unknown as MatchDetail;
    renderShell(<MatchRecapTab detail={detail} accountSlug="me" />);
    // The First Blood + First Tower chips render once each, on the team that
    // earned them.
    expect(screen.getByText("First Blood")).toBeTruthy();
    expect(screen.getByText("First Tower")).toBeTruthy();
  });

  it("awards no badges when the top two values are tied across every metric", () => {
    const tied = {
      matchId: "EUW1_TIED",
      queueType: "Ranked Solo",
      durationSec: 1800,
      playedAt: "2026-05-19T10:00:00Z",
      teams: [team(100, true, 60000, 20), team(200, false, 50000, 12)],
      participants: [
        participant({ puuid: "A", teamId: 100, totalDamage: 20000, visionScore: 25 }),
        participant({ puuid: "B", teamId: 100, totalDamage: 20000, visionScore: 25 }),
        participant({ puuid: "C", teamId: 200, totalDamage: 20000, visionScore: 25 }),
        participant({ puuid: "D", teamId: 200, totalDamage: 20000, visionScore: 25 }),
      ],
    } as unknown as MatchDetail;
    renderShell(<MatchRecapTab detail={tied} accountSlug="me" />);
    // None of the badge labels render — the recap surfaces them only on a
    // distinctive winner.
    expect(screen.queryByText("Top DMG")).toBeNull();
    expect(screen.queryByText("Top KDA")).toBeNull();
    expect(screen.queryByText("Top Vision")).toBeNull();
    expect(screen.queryByText("Top KP")).toBeNull();
    expect(screen.queryByText("Top CS")).toBeNull();
    expect(screen.queryByText("Low Deaths")).toBeNull();
  });
});
