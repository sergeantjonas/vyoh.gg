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
    data: new Map<number, { name: string; iconUrl: string; categories: string[] }>([
      [1001, { name: "Boots", iconUrl: "x", categories: [] }],
      [3068, { name: "Sunfire", iconUrl: "x", categories: [] }],
      [2003, { name: "Health Potion", iconUrl: "x", categories: ["Consumable"] }],
      [3340, { name: "Stealth Ward", iconUrl: "x", categories: ["Trinket"] }],
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

  it("renders 'No items' when the participant has no build events", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      build: [{ participantId: 1, events: [] }],
    });
    mockItems();
    renderBuild({ myPuuid: "me" });
    expect(screen.getByText("No items")).toBeTruthy();
  });

  it("renders purchased items and filters out consumables by default", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      build: [
        {
          participantId: 1,
          events: [
            { type: "PURCHASED", itemId: 1001, ts: 60_000 },
            { type: "PURCHASED", itemId: 3068, ts: 300_000 },
            // Health Potion is a Consumable — should be filtered out.
            { type: "PURCHASED", itemId: 2003, ts: 60_000 },
            // Stealth Ward is a Trinket — also filtered.
            { type: "PURCHASED", itemId: 3340, ts: 60_000 },
          ],
        },
      ],
    });
    mockItems();
    renderBuild({ myPuuid: "me" });
    expect(screen.getByAltText("Boots")).toBeTruthy();
    expect(screen.getByAltText("Sunfire")).toBeTruthy();
    expect(screen.queryByAltText("Health Potion")).toBeNull();
    expect(screen.queryByAltText("Stealth Ward")).toBeNull();
  });

  it("includes consumables once the toggle is enabled", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      build: [
        {
          participantId: 1,
          events: [
            { type: "PURCHASED", itemId: 1001, ts: 60_000 },
            { type: "PURCHASED", itemId: 2003, ts: 90_000 },
          ],
        },
      ],
    });
    mockItems();
    renderBuild({ myPuuid: "me" });
    expect(screen.queryByAltText("Health Potion")).toBeNull();
    fireEvent.click(screen.getByText("Show consumables"));
    expect(screen.getByAltText("Health Potion")).toBeTruthy();
  });

  it("removes the matching purchase when an UNDO event follows it", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      build: [
        {
          participantId: 1,
          events: [
            { type: "PURCHASED", itemId: 1001, ts: 60_000 },
            { type: "PURCHASED", itemId: 3068, ts: 120_000 },
            { type: "UNDO", itemId: 3068, ts: 121_000 },
          ],
        },
      ],
    });
    mockItems();
    renderBuild({ myPuuid: "me" });
    expect(screen.getByAltText("Boots")).toBeTruthy();
    // Sunfire was undone — no entry should remain for it.
    expect(screen.queryByAltText("Sunfire")).toBeNull();
  });

  it("converts a PURCHASED entry into SOLD when a SOLD event references it", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      build: [
        {
          participantId: 1,
          events: [
            { type: "PURCHASED", itemId: 1001, ts: 60_000 },
            { type: "SOLD", itemId: 1001, ts: 600_000 },
            { type: "PURCHASED", itemId: 3068, ts: 700_000 },
          ],
        },
      ],
    });
    mockItems();
    const { container } = renderBuild({ myPuuid: "me" });
    // Both icons still present (one as SOLD-styled, one as PURCHASED).
    expect(screen.getByAltText("Boots")).toBeTruthy();
    expect(screen.getByAltText("Sunfire")).toBeTruthy();
    // SOLD entries get a red tint on the timestamp.
    expect(container.querySelector(".text-red-400\\/50")).toBeTruthy();
  });

  it("toggles 'Hide opponent' → 'Show opponent' on click", () => {
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
    fireEvent.click(screen.getByText("Hide opponent"));
    expect(screen.getByText("Show opponent")).toBeTruthy();
  });
});
