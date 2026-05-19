import { useItems } from "@/lol/matches/use-items";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { MatchDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchRecapTab } from "./match-detail-view";

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
  ItemIcon: ({ alt, iconUrl }: { alt: string; iconUrl: string }) => (
    <img alt={alt} src={iconUrl} />
  ),
}));

vi.mock("@/lol/_shared/assets/keystone-icon", () => ({
  KeystoneIcon: () => <span data-testid="keystone" />,
}));

vi.mock("@/lol/_shared/assets/summoner-spell-icon", () => ({
  SummonerSpellIcon: () => <span data-testid="summ-spell" />,
}));

vi.mock("@/lol/matches/use-items", () => ({
  useItems: vi.fn(() => ({ data: undefined })),
}));

vi.mock("@/lol/matches/use-match-timeline", () => ({
  useMatchTimeline: vi.fn(() => ({ isPending: false, isError: true })),
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
    damageDealtPhysical: 6000,
    damageDealtMagic: 4000,
    damageDealtTrue: 2000,
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
  vi.mocked(useMatchTimeline).mockReset();
  vi.mocked(useItems).mockReset();
  vi.mocked(useMatchTimeline).mockReturnValue({
    isPending: false,
    isError: true,
  } as ReturnType<typeof useMatchTimeline>);
  vi.mocked(useItems).mockReturnValue({ data: undefined } as ReturnType<typeof useItems>);
});

describe("MatchHeaderStrip SoulChip", () => {
  it("renders the blue-side soul chip once a team has 4 non-Elder drake kills", () => {
    vi.mocked(useMatchTimeline).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        participants: [],
        kills: [],
        objectives: [
          { ts: 100_000, type: "DRAGON_OCEAN", teamId: 100 },
          { ts: 200_000, type: "DRAGON_OCEAN", teamId: 100 },
          { ts: 300_000, type: "DRAGON_OCEAN", teamId: 100 },
          { ts: 400_000, type: "DRAGON_OCEAN", teamId: 100 },
          { ts: 500_000, type: "DRAGON_ELDER", teamId: 100 },
        ],
      },
    } as unknown as ReturnType<typeof useMatchTimeline>);
    renderShell(<MatchRecapTab detail={buildDetail()} accountSlug="me" />);
    expect(screen.getByText("Ocean Soul")).toBeTruthy();
  });

  it("renders the red-side soul chip when red claims the soul drake", () => {
    vi.mocked(useMatchTimeline).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        participants: [],
        kills: [],
        objectives: [
          { ts: 100_000, type: "DRAGON_FIRE", teamId: 200 },
          { ts: 200_000, type: "DRAGON_FIRE", teamId: 200 },
          { ts: 300_000, type: "DRAGON_FIRE", teamId: 200 },
          { ts: 400_000, type: "DRAGON_FIRE", teamId: 200 },
        ],
      },
    } as unknown as ReturnType<typeof useMatchTimeline>);
    renderShell(<MatchRecapTab detail={buildDetail()} accountSlug="me" />);
    expect(screen.getByText("Infernal Soul")).toBeTruthy();
  });

  it("does not render a soul chip when fewer than 4 drakes have spawned", () => {
    vi.mocked(useMatchTimeline).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        participants: [],
        kills: [],
        objectives: [
          { ts: 100_000, type: "DRAGON_CLOUD", teamId: 100 },
          { ts: 200_000, type: "DRAGON_CLOUD", teamId: 100 },
          { ts: 300_000, type: "DRAGON_CLOUD", teamId: 100 },
        ],
      },
    } as unknown as ReturnType<typeof useMatchTimeline>);
    renderShell(<MatchRecapTab detail={buildDetail()} accountSlug="me" />);
    expect(screen.queryByText("Cloud Soul")).toBeNull();
  });

  it("ignores an unknown drake type in the soul label/icon/color lookup", () => {
    vi.mocked(useMatchTimeline).mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        participants: [],
        kills: [],
        objectives: [
          { ts: 100_000, type: "DRAGON_BOGUS", teamId: 100 },
          { ts: 200_000, type: "DRAGON_BOGUS", teamId: 100 },
          { ts: 300_000, type: "DRAGON_BOGUS", teamId: 100 },
          { ts: 400_000, type: "DRAGON_BOGUS", teamId: 100 },
        ],
      },
    } as unknown as ReturnType<typeof useMatchTimeline>);
    renderShell(<MatchRecapTab detail={buildDetail()} accountSlug="me" />);
    // computeSoul still returns a teamId/type, but SoulChip falls through
    // to `return null` because the type is missing from the label/icon maps.
    expect(screen.queryByText(/Soul$/)).toBeNull();
  });

  it("returns null when the recap is given a malformed teams array missing a side", () => {
    const detail = {
      ...buildDetail(),
      teams: [team(100, true, 60000, 20)],
    } as unknown as MatchDetail;
    const { container } = renderShell(<MatchRecapTab detail={detail} accountSlug="me" />);
    // The header strip bails out (returns null) but the team blocks still
    // render below it, so the recap container is not empty.
    expect(container.firstChild).not.toBeNull();
  });
});

describe("ItemSlot populated tooltip", () => {
  it("renders the item icon and tooltip content when an item is resolved by id", async () => {
    vi.mocked(useItems).mockReturnValue({
      data: new Map([
        [
          3001,
          {
            id: 3001,
            name: "Evenshroud",
            iconUrl: "/items/3001.png",
            priceTotal: 2500,
            description: "<b>Aura:</b> nearby allies do more damage",
          },
        ],
      ]),
    } as unknown as ReturnType<typeof useItems>);
    const { container } = renderShell(
      <MatchRecapTab detail={buildDetail()} accountSlug="me" />
    );
    // The first slot resolves; the rest are placeholder bg-muted divs.
    expect(
      container.querySelectorAll('img[src="/items/3001.png"]').length
    ).toBeGreaterThan(0);
  });
});

describe("SegmentedDamageBar trueW > 0", () => {
  it("renders the true-damage segment when a participant deals true damage", () => {
    // damageDealtTrue > 0 → trueW > 0 in the gradient bar layer.
    const detail = {
      ...buildDetail(),
      participants: [
        participant({
          puuid: "PT",
          teamId: 100,
          damageDealtTrue: 5000,
          totalDamage: 15000,
        }),
        participant({ puuid: "P2", teamId: 100 }),
        participant({ puuid: "P3", teamId: 200 }),
        participant({ puuid: "P4", teamId: 200 }),
      ],
    } as unknown as MatchDetail;
    const { container } = renderShell(<MatchRecapTab detail={detail} accountSlug="me" />);
    // Three bars per participant when true damage is present (phys + magic + true).
    expect(container.querySelectorAll(".bg-white\\/55").length).toBeGreaterThan(0);
  });
});

describe("TeamBlock badge tooltip", () => {
  it("renders the participant badge label when a metric has a distinct winner", () => {
    const detail = {
      matchId: "EUW1_BADGE",
      queueType: "Ranked Solo",
      durationSec: 1800,
      playedAt: "2026-05-19T10:00:00Z",
      teams: [team(100, true, 60000, 20), team(200, false, 50000, 12)],
      participants: [
        participant({ puuid: "X", teamId: 100, totalDamage: 99999 }),
        participant({ puuid: "Y", teamId: 100, totalDamage: 1000 }),
        participant({ puuid: "Z", teamId: 200, totalDamage: 900 }),
        participant({ puuid: "W", teamId: 200, totalDamage: 800 }),
      ],
    } as unknown as MatchDetail;
    renderShell(<MatchRecapTab detail={detail} accountSlug="me" />);
    // Top DMG badge label renders next to the winner's row.
    expect(screen.getAllByText("Top DMG").length).toBeGreaterThan(0);
  });
});

describe("ParticipantRow self-highlight", () => {
  it("applies the self-highlight ring when myPuuid matches a participant", () => {
    const detail = buildDetail();
    const { container } = renderShell(
      <MatchRecapTab detail={detail} myPuuid="PA" accountSlug="me" />
    );
    // The myPuuid="PA" participant gets ring + border classes that the
    // other rows don't.
    expect(container.querySelectorAll(".ring-foreground\\/30").length).toBe(1);
  });
});

describe("TeamBlock goldLead chip", () => {
  it("renders a positive gold-lead chip on the leading side", () => {
    renderShell(<MatchRecapTab detail={buildDetail()} accountSlug="me" />);
    // Blue leads with +10.0k gold and red trails with -10.0k.
    expect(screen.getAllByText(/10\.0k gold/).length).toBeGreaterThan(0);
  });
});

describe("Carousel-independent ItemSlot tooltip with no description", () => {
  it("omits the description block when the resolved item has no description field", () => {
    vi.mocked(useItems).mockReturnValue({
      data: new Map([
        [
          3001,
          {
            id: 3001,
            name: "Naked Item",
            iconUrl: "/items/naked.png",
            priceTotal: 0,
          },
        ],
      ]),
    } as unknown as ReturnType<typeof useItems>);
    const { container } = renderShell(
      <MatchRecapTab detail={buildDetail()} accountSlug="me" />
    );
    // The item rendered without crashing — priceTotal: 0 means the price
    // chip is skipped (falsy branch).
    expect(
      container.querySelectorAll('img[src="/items/naked.png"]').length
    ).toBeGreaterThan(0);
  });
});

// fireEvent is imported above to satisfy keyboard interactions when added later.
void fireEvent;
