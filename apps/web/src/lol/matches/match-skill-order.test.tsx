import { useAbilityDescription } from "@/lol/matches/use-ability-description";
import { useChampionSpells } from "@/lol/matches/use-champion-spells";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ParticipantDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchSkillOrder } from "./match-skill-order";

vi.mock("@/lol/matches/use-match-timeline", () => ({
  useMatchTimeline: vi.fn(),
}));

vi.mock("@/lol/matches/use-champion-spells", () => ({
  useChampionSpells: vi.fn(),
}));

vi.mock("@/lol/matches/use-ability-description", () => ({
  useAbilityDescription: vi.fn(),
}));

function participant(puuid: string, championName = "Ahri"): ParticipantDetail {
  return { puuid, championName } as unknown as ParticipantDetail;
}

type TimelineSlot = { slot: 1 | 2 | 3 | 4; ts: number };

function mockTimeline(value: {
  participants?: Array<{ puuid: string; participantId: number }>;
  skillOrders?: Array<{ participantId: number; slots: TimelineSlot[] }>;
  isPending?: boolean;
  isError?: boolean;
}) {
  vi.mocked(useMatchTimeline).mockReturnValue({
    data: {
      participants: value.participants ?? [],
      skillOrders: value.skillOrders ?? [],
    },
    isPending: value.isPending ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useMatchTimeline>);
}

function renderOrder(props: {
  myPuuid?: string;
  participants?: ParticipantDetail[];
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="always">
        <TooltipPrimitive.Provider>
          <MatchSkillOrder
            detail={{
              matchId: "EUW1_1",
              participants: props.participants ?? [participant("me")],
            }}
            {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
          />
        </TooltipPrimitive.Provider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

function mockDescription(value: {
  isPending?: boolean;
  descriptionHtml?: string | null;
  descriptionWikitext?: string | null;
}) {
  vi.mocked(useAbilityDescription).mockReturnValue({
    data: value.isPending
      ? undefined
      : {
          championId: 103,
          slot: "Q",
          abilityIndex: 1,
          name: "Orb of Deception",
          iconWikiName: null,
          descriptionHtml: value.descriptionHtml ?? null,
          descriptionWikitext: value.descriptionWikitext ?? null,
        },
    isPending: value.isPending ?? false,
    isError: false,
  } as unknown as ReturnType<typeof useAbilityDescription>);
}

afterEach(() => {
  vi.mocked(useMatchTimeline).mockReset();
  vi.mocked(useChampionSpells).mockReset();
  vi.mocked(useAbilityDescription).mockReset();
});

describe("MatchSkillOrder", () => {
  it("renders nothing when myPuuid is missing", () => {
    mockTimeline({});
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    mockDescription({ isPending: false });
    const { container } = renderOrder({});
    expect(container.firstChild).toBeNull();
  });

  it("renders the pending shimmer while the timeline loads", () => {
    mockTimeline({ isPending: true });
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    mockDescription({ isPending: false });
    const { container } = renderOrder({ myPuuid: "me" });
    expect(container.querySelectorAll("[class*='animate']").length).toBeGreaterThan(0);
  });

  it("renders nothing when the timeline query errors", () => {
    mockTimeline({ isError: true });
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    mockDescription({ isPending: false });
    const { container } = renderOrder({ myPuuid: "me" });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the participant has no skill-order rows", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      skillOrders: [{ participantId: 1, slots: [] }],
    });
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    mockDescription({ isPending: false });
    const { container } = renderOrder({ myPuuid: "me" });
    expect(container.firstChild).toBeNull();
  });

  it("renders the Skill order section with Q/W/E/R labels when data is present", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      skillOrders: [
        {
          participantId: 1,
          slots: [
            { slot: 1, ts: 60_000 },
            { slot: 2, ts: 120_000 },
            { slot: 1, ts: 180_000 },
          ],
        },
      ],
    });
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    mockDescription({ isPending: false });
    renderOrder({ myPuuid: "me" });
    expect(screen.getByText("Skill order")).toBeTruthy();
    expect(screen.getByText("Q")).toBeTruthy();
    expect(screen.getByText("W")).toBeTruthy();
    expect(screen.getByText("E")).toBeTruthy();
    expect(screen.getByText("R")).toBeTruthy();
  });

  it("renders spell icons synchronously from useChampionSpells (icon/name from bundle)", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      skillOrders: [{ participantId: 1, slots: [{ slot: 1, ts: 60_000 }] }],
    });
    vi.mocked(useChampionSpells).mockReturnValue([
      {
        championId: 103,
        slot: "Q",
        abilityIndex: 1,
        iconUrl: "https://wiki.example/Ahri_Orb_of_Deception.png",
        name: "Orb of Deception",
      },
      {
        championId: 103,
        slot: "W",
        abilityIndex: 2,
        iconUrl: "https://wiki.example/Ahri_Fox-Fire.png",
        name: "Fox-Fire",
      },
      {
        championId: 103,
        slot: "E",
        abilityIndex: 3,
        iconUrl: "https://wiki.example/Ahri_Charm.png",
        name: "Charm",
      },
      {
        championId: 103,
        slot: "R",
        abilityIndex: 4,
        iconUrl: "https://wiki.example/Ahri_Spirit_Rush.png",
        name: "Spirit Rush",
      },
    ]);
    // Even with description still pending, the row icons must render.
    mockDescription({ isPending: true });
    renderOrder({ myPuuid: "me" });
    const icons = screen.getAllByAltText(/^[QWER]$/);
    expect(icons.length).toBe(4);
    expect(icons[0]?.getAttribute("src")).toContain("Orb_of_Deception");
  });
});
