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

  it("handles a pending timeline gracefully (no events, no crash)", () => {
    setTimeline({ isPending: true, isError: false, data: undefined });
    expect(() => renderShell()).not.toThrow();
  });
});
