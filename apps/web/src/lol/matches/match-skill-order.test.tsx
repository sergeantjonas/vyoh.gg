import { useChampionSpells } from "@/lol/matches/use-champion-spells";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
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
  return render(
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
  );
}

afterEach(() => {
  vi.mocked(useMatchTimeline).mockReset();
  vi.mocked(useChampionSpells).mockReset();
});

describe("MatchSkillOrder", () => {
  it("renders nothing when myPuuid is missing", () => {
    mockTimeline({});
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderOrder({});
    expect(container.firstChild).toBeNull();
  });

  it("renders the pending shimmer while the timeline loads", () => {
    mockTimeline({ isPending: true });
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderOrder({ myPuuid: "me" });
    expect(container.querySelectorAll("[class*='animate']").length).toBeGreaterThan(0);
  });

  it("renders nothing when the timeline query errors", () => {
    mockTimeline({ isError: true });
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
    const { container } = renderOrder({ myPuuid: "me" });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the participant has no skill-order rows", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      skillOrders: [{ participantId: 1, slots: [] }],
    });
    vi.mocked(useChampionSpells).mockReturnValue(undefined);
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
    renderOrder({ myPuuid: "me" });
    expect(screen.getByText("Skill order")).toBeTruthy();
    expect(screen.getByText("Q")).toBeTruthy();
    expect(screen.getByText("W")).toBeTruthy();
    expect(screen.getByText("E")).toBeTruthy();
    expect(screen.getByText("R")).toBeTruthy();
  });
});
