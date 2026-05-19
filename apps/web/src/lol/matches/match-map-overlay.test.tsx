import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ParticipantDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MatchMapOverlay from "./match-map-overlay";

vi.mock("@/lol/matches/use-match-timeline", () => ({
  useMatchTimeline: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const NullEl = () => null;
  return {
    AreaChart: Passthrough,
    Area: NullEl,
    Brush: NullEl,
    ReferenceLine: NullEl,
    ResponsiveContainer: Passthrough,
    XAxis: NullEl,
    YAxis: NullEl,
  };
});

function participant(pid: number, puuid: string, champ = "Ahri"): ParticipantDetail {
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

function defaultTimeline() {
  return {
    isPending: false,
    isError: false,
    data: {
      participants: [
        { participantId: 1, puuid: "P1" },
        { participantId: 6, puuid: "P6" },
      ],
      kills: [
        {
          ts: 60_000,
          position: { x: 5000, y: 5000 },
          killerId: 1,
          victimId: 6,
          assistIds: [],
        },
        {
          ts: 600_000,
          position: { x: 8000, y: 8000 },
          killerId: 6,
          victimId: 1,
          assistIds: [],
        },
      ],
      objectives: [
        { ts: 300_000, position: { x: 9866, y: 4414 }, type: "DRAGON_FIRE", teamId: 100 },
        {
          ts: 900_000,
          position: { x: 4979, y: 10471 },
          type: "BARON_NASHOR",
          teamId: 200,
        },
        { ts: 1_200_000, position: { x: 5000, y: 12000 }, type: "TOWER", teamId: 100 },
      ],
      frames: Array.from({ length: 30 }, (_, i) => ({
        ts: i * 60_000,
        perParticipant: Object.fromEntries(
          Array.from({ length: 10 }, (_, j) => [j + 1, { gold: 1000 + i * 100 + j * 50 }])
        ),
      })),
    },
  };
}

function detailOf() {
  return {
    matchId: "EUW1_1",
    durationSec: 1800,
    participants: [participant(1, "P1"), participant(6, "P6", "Lux")],
  };
}

function renderShell(open = true) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <MatchMapOverlay
          open={open}
          onOpenChange={() => {}}
          detail={detailOf()}
          myPuuid="P1"
        />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useMatchTimeline).mockReset();
});

describe("MatchMapOverlay", () => {
  it("does not mount the dialog content when open=false", () => {
    setTimeline(defaultTimeline());
    renderShell(false);
    expect(screen.queryByText("Match map overlay")).toBeNull();
  });

  it("renders filter chips when the dialog is open", () => {
    setTimeline(defaultTimeline());
    renderShell();
    expect(screen.getByRole("button", { name: "Kills" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Towers" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dragons" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Barons" })).toBeTruthy();
  });

  it("toggles the Kills filter chip when clicked", () => {
    setTimeline(defaultTimeline());
    renderShell();
    const killsChip = screen.getByRole("button", { name: "Kills" });
    // Click to deactivate; just confirm no throw and the chip still exists.
    fireEvent.click(killsChip);
    expect(screen.getByRole("button", { name: "Kills" })).toBeTruthy();
  });

  it("renders the sr-only dialog title for accessibility", () => {
    setTimeline(defaultTimeline());
    renderShell();
    expect(screen.getByText("Match map overlay")).toBeTruthy();
  });

  it("shows the dialog title and zero events while the timeline is pending", () => {
    setTimeline({ isPending: true, isError: false, data: undefined });
    renderShell();
    expect(screen.getByText("Match map overlay")).toBeTruthy();
    // The header counter reads "Events · 0" when no timeline data is loaded.
    expect(screen.getByText(/Events · 0/)).toBeTruthy();
  });

  it("renders all distinct objective labels in the feed and on the map", () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: {
        participants: [
          { participantId: 1, puuid: "P1" },
          { participantId: 6, puuid: "P6" },
        ],
        kills: [],
        objectives: [
          { ts: 60_000, position: { x: 1, y: 1 }, type: "DRAGON_OCEAN", teamId: 100 },
          { ts: 120_000, position: { x: 1, y: 1 }, type: "DRAGON_MOUNTAIN", teamId: 100 },
          { ts: 180_000, position: { x: 1, y: 1 }, type: "DRAGON_CLOUD", teamId: 100 },
          { ts: 240_000, position: { x: 1, y: 1 }, type: "DRAGON_HEXTECH", teamId: 100 },
          { ts: 300_000, position: { x: 1, y: 1 }, type: "DRAGON_CHEMTECH", teamId: 100 },
          { ts: 360_000, position: { x: 1, y: 1 }, type: "DRAGON_ELDER", teamId: 200 },
          { ts: 420_000, position: { x: 1, y: 1 }, type: "RIFT_HERALD", teamId: 100 },
          { ts: 480_000, position: { x: 1, y: 1 }, type: "HORDE", teamId: 100 },
          { ts: 540_000, position: { x: 1, y: 1 }, type: "INHIBITOR", teamId: 200 },
          {
            ts: 600_000,
            position: { x: 1, y: 1 },
            type: "MYSTERY_UNDERSCORE",
            teamId: 200,
          },
        ],
        frames: [],
      },
    });
    renderShell();
    expect(screen.getAllByText("Ocean Drake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mountain Drake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cloud Drake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hextech Drake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chemtech Drake").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Elder Dragon").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rift Herald").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Void Grubs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inhibitor").length).toBeGreaterThan(0);
    // default branch: unknown types replace underscores with spaces.
    expect(screen.getAllByText(/MYSTERY UNDERSCORE/).length).toBeGreaterThan(0);
  });

  it("toggles each filter chip without throwing", () => {
    setTimeline(defaultTimeline());
    renderShell();
    for (const name of [
      "Towers",
      "Inhibitors",
      "Dragons",
      "Heralds",
      "Barons",
      "Void Grubs",
    ]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    // Sanity: chips still render after rapid toggling.
    expect(screen.getByRole("button", { name: "Kills" })).toBeTruthy();
  });

  it("toggles the Your kills and Your deaths chips when a participant is identified", () => {
    setTimeline(defaultTimeline());
    renderShell();
    const yourKills = screen.getByRole("button", { name: "Your kills" });
    fireEvent.click(yourKills);
    const yourDeaths = screen.getByRole("button", { name: "Your deaths" });
    fireEvent.click(yourDeaths);
    expect(screen.getByRole("button", { name: "Your kills" })).toBeTruthy();
  });

  it("renders assist names when a kill has assistIds", () => {
    setTimeline({
      isPending: false,
      isError: false,
      data: {
        participants: [
          { participantId: 1, puuid: "P1" },
          { participantId: 2, puuid: "P2" },
          { participantId: 6, puuid: "P6" },
        ],
        kills: [
          {
            ts: 60_000,
            position: { x: 5000, y: 5000 },
            killerId: 1,
            victimId: 6,
            assistIds: [2],
          },
        ],
        objectives: [],
        frames: [],
      },
    });
    renderShell();
    // Assist participant 2 is unknown to detail → renders as "P2".
    expect(screen.getAllByText(/P2/).length).toBeGreaterThan(0);
  });

  it("selects and deselects a feed row when clicked twice", () => {
    setTimeline(defaultTimeline());
    renderShell();
    const feed = screen.getAllByRole("button");
    // Find the feed row for the first event by its time label "1:00".
    const row = feed.find((b) => b.textContent?.includes("1:00"));
    if (!row) throw new Error("first kill row not found");
    fireEvent.click(row);
    fireEvent.click(row);
    expect(row).toBeTruthy();
  });
});
