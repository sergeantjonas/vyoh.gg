import { useItems } from "@/lol/matches/use-items";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ParticipantDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchBuildOrder } from "./match-build-order";

vi.mock("@/lol/matches/use-match-timeline", () => ({
  useMatchTimeline: vi.fn(),
}));

vi.mock("@/lol/matches/use-items", () => ({
  useItems: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ championName }: { championName: string }) => (
    <span data-champion={championName} />
  ),
}));

vi.mock("@/lol/_shared/assets/item-icon", () => ({
  ItemIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function participant(
  puuid: string,
  teamId: 100 | 200,
  teamPosition?: string
): ParticipantDetail {
  return {
    puuid,
    teamId,
    championName: "Ahri",
    riotIdGameName: "Player",
    ...(teamPosition !== undefined && { teamPosition }),
  } as unknown as ParticipantDetail;
}

function mockTimeline(value: {
  participants?: Array<{ puuid: string; participantId: number }>;
  build?: Array<{
    participantId: number;
    events: Array<{ type: "PURCHASED" | "SOLD" | "UNDO"; itemId: number; ts: number }>;
  }>;
  isPending?: boolean;
  isError?: boolean;
}) {
  vi.mocked(useMatchTimeline).mockReturnValue({
    data: {
      participants: value.participants ?? [],
      build: value.build ?? [],
      buildOrders: value.build ?? [],
    },
    isPending: value.isPending ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useMatchTimeline>);
}

function mockItems() {
  vi.mocked(useItems).mockReturnValue({
    data: new Map([
      [1001, { name: "Boots", iconUrl: "x", categories: [] }],
      [3068, { name: "Sunfire", iconUrl: "x", categories: [] }],
    ]),
  } as unknown as ReturnType<typeof useItems>);
}

function renderBuild(props: {
  myPuuid?: string;
  participants?: ParticipantDetail[];
  queueType?: string;
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <MatchBuildOrder
          detail={{
            matchId: "EUW1_1",
            queueType: props.queueType ?? "Ranked Solo",
            participants: props.participants ?? [participant("me", 100, "MIDDLE")],
          }}
          {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
        />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useMatchTimeline).mockReset();
  vi.mocked(useItems).mockReset();
});

describe("MatchBuildOrder", () => {
  it("renders nothing when myPuuid is missing", () => {
    mockTimeline({});
    mockItems();
    const { container } = renderBuild({});
    expect(container.firstChild).toBeNull();
  });

  it("renders the pending shimmer while the timeline loads", () => {
    mockTimeline({ isPending: true });
    mockItems();
    const { container } = renderBuild({ myPuuid: "me" });
    expect(container.querySelectorAll("[class*='animate']").length).toBeGreaterThan(0);
  });

  it("renders the Build order header with toggle buttons when data is present", () => {
    mockTimeline({
      participants: [
        { puuid: "me", participantId: 1 },
        { puuid: "opp", participantId: 6 },
      ],
    });
    mockItems();
    renderBuild({
      myPuuid: "me",
      participants: [participant("me", 100, "MIDDLE"), participant("opp", 200, "MIDDLE")],
    });
    expect(screen.getByText("Build order")).toBeTruthy();
    expect(screen.getByText("Show consumables")).toBeTruthy();
  });

  it("toggles 'Show consumables' → 'Hide consumables' on click", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
    });
    mockItems();
    renderBuild({ myPuuid: "me" });
    fireEvent.click(screen.getByText("Show consumables"));
    expect(screen.getByText("Hide consumables")).toBeTruthy();
  });

  it("renders the 'Hide opponent' button by default for ranked matches with an opponent", () => {
    mockTimeline({
      participants: [
        { puuid: "me", participantId: 1 },
        { puuid: "opp", participantId: 6 },
      ],
    });
    mockItems();
    renderBuild({
      myPuuid: "me",
      participants: [participant("me", 100, "MIDDLE"), participant("opp", 200, "MIDDLE")],
    });
    expect(screen.getByText("Hide opponent")).toBeTruthy();
  });

  it("omits the opponent toggle for non-ranked queues", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
    });
    mockItems();
    renderBuild({
      myPuuid: "me",
      queueType: "Normal Draft",
      participants: [participant("me", 100, "MIDDLE")],
    });
    expect(screen.queryByText(/opponent/i)).toBeNull();
  });
});
