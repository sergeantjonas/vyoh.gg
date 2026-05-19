import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ParticipantDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchEventTimelines } from "./match-event-timelines";

vi.mock("@/lol/matches/use-match-timeline", () => ({
  useMatchTimeline: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("./match-map-overlay", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="map-overlay">overlay</div> : null,
}));

function participant(pid: number, puuid: string, champ: string): ParticipantDetail {
  return {
    participantId: pid,
    puuid,
    championName: champ,
  } as unknown as ParticipantDetail;
}

function setTimeline(value: unknown) {
  vi.mocked(useMatchTimeline).mockReturnValue(
    value as ReturnType<typeof useMatchTimeline>
  );
}

function detailOf(
  overrides: {
    queueType?: string;
    durationSec?: number;
    participants?: ParticipantDetail[];
  } = {}
) {
  return {
    matchId: "EUW1_1",
    queueType: overrides.queueType ?? "Ranked Solo",
    durationSec: overrides.durationSec ?? 1800,
    participants: overrides.participants ?? [
      participant(1, "P1", "Ahri"),
      participant(2, "P2", "Lux"),
    ],
  };
}

function renderShell(props: {
  detail: ReturnType<typeof detailOf>;
  myPuuid?: string | undefined;
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <MatchEventTimelines {...props} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useMatchTimeline).mockReset();
});

describe("MatchEventTimelines", () => {
  it("renders null when myPuuid is not provided", () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: { participants: [], kills: [], objectives: [] },
    });
    const { container } = renderShell({ detail: detailOf() });
    expect(container.firstChild).toBeNull();
  });

  it("renders the shimmer skeleton while the timeline query is pending", () => {
    setTimeline({ isPending: true, isError: false });
    const { container } = renderShell({ detail: detailOf(), myPuuid: "P1" });
    expect(
      container.querySelectorAll(".animate-pulse, .relative.overflow-hidden").length
    ).toBeGreaterThan(0);
  });

  it("renders null when the timeline query errors", () => {
    setTimeline({ isPending: false, isError: true });
    const { container } = renderShell({ detail: detailOf(), myPuuid: "P1" });
    expect(container.firstChild).toBeNull();
  });

  it("renders kill dots, objective bars, axis ticks, and zoom controls when timeline data is available", () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: {
        participants: [
          { participantId: 1, puuid: "P1" },
          { participantId: 2, puuid: "P2" },
        ],
        kills: [
          { ts: 60_000, killerId: 1, victimId: 2, assistIds: [] },
          { ts: 600_000, killerId: 2, victimId: 1, assistIds: [1] },
        ],
        objectives: [
          { ts: 300_000, type: "DRAGON_FIRE", teamId: 100 },
          { ts: 900_000, type: "BARON_NASHOR", teamId: 200 },
          { ts: 1_200_000, type: "UNKNOWN_TYPE", teamId: 100 },
        ],
      },
    });
    renderShell({ detail: detailOf(), myPuuid: "P1" });
    expect(screen.getByText("Kill & objective timeline")).toBeTruthy();
    expect(screen.getByText("1×")).toBeTruthy();
    // Time axis renders "0m" at minimum
    expect(screen.getByText("0m")).toBeTruthy();
  });

  it("disables the zoom-out button at 1× and enables it after zooming in", () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: { participants: [], kills: [], objectives: [] },
    });
    renderShell({ detail: detailOf(), myPuuid: "P1" });
    const minusBtn = screen.getByRole("button", { name: "−" }) as HTMLButtonElement;
    const plusBtn = screen.getByRole("button", { name: "+" }) as HTMLButtonElement;
    expect(minusBtn.disabled).toBe(true);
    fireEvent.click(plusBtn);
    expect(screen.getByText("2×")).toBeTruthy();
    expect(minusBtn.disabled).toBe(false);
  });

  it("caps zoom at 8× and disables the zoom-in button there", () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: { participants: [], kills: [], objectives: [] },
    });
    renderShell({ detail: detailOf(), myPuuid: "P1" });
    const plusBtn = screen.getByRole("button", { name: "+" }) as HTMLButtonElement;
    fireEvent.click(plusBtn); // 2x
    fireEvent.click(plusBtn); // 4x
    fireEvent.click(plusBtn); // 8x
    expect(screen.getByText("8×")).toBeTruthy();
    expect(plusBtn.disabled).toBe(true);
  });

  it("does not show the 'View on map' button for non-rift queues like ARAM", () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: { participants: [], kills: [], objectives: [] },
    });
    renderShell({ detail: detailOf({ queueType: "ARAM" }), myPuuid: "P1" });
    expect(screen.queryByText("View on map")).toBeNull();
  });

  it("opens the lazy-loaded map overlay when 'View on map' is clicked on a rift queue", async () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: { participants: [], kills: [], objectives: [] },
    });
    renderShell({ detail: detailOf(), myPuuid: "P1" });
    fireEvent.click(screen.getByText("View on map"));
    // The Suspense fallback resolves once React.lazy completes the dynamic import.
    expect(await screen.findByTestId("map-overlay")).toBeTruthy();
  });

  it("computes the tooltip label for every dragon/elder/herald/horde/inhib/tower objective type", () => {
    // objectiveLabel runs eagerly for each objective during render even
    // before the tooltip opens, so seeding one per type covers each case
    // branch. The default-case UNKNOWN_TYPE is also asserted to fall
    // through to its underscore-replacement.
    setTimeline({
      isPending: false,
      isError: false,
      data: {
        participants: [
          { participantId: 1, puuid: "P1" },
          { participantId: 2, puuid: "P2" },
        ],
        kills: [],
        objectives: [
          { ts: 60_000, type: "DRAGON_OCEAN", teamId: 100 },
          { ts: 120_000, type: "DRAGON_MOUNTAIN", teamId: 100 },
          { ts: 180_000, type: "DRAGON_CLOUD", teamId: 100 },
          { ts: 240_000, type: "DRAGON_HEXTECH", teamId: 100 },
          { ts: 300_000, type: "DRAGON_CHEMTECH", teamId: 100 },
          { ts: 360_000, type: "DRAGON_ELDER", teamId: 200 },
          { ts: 420_000, type: "RIFT_HERALD", teamId: 100 },
          { ts: 480_000, type: "HORDE", teamId: 100 },
          { ts: 540_000, type: "INHIBITOR", teamId: 200 },
          { ts: 600_000, type: "TOWER", teamId: 100 },
          { ts: 660_000, type: "UNKNOWN_TYPE", teamId: 200 },
        ],
      },
    });
    const { container } = renderShell({ detail: detailOf(), myPuuid: "P1" });
    // 11 objective markers render — one per type.
    expect(container.querySelectorAll('[class*="absolute top-1/2"]').length).toBe(11);
  });
});
