import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import { render, screen } from "@testing-library/react";
import type { ParticipantDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchLanePhase } from "./match-lane-phase";

vi.mock("@/lol/matches/use-match-timeline", () => ({
  useMatchTimeline: vi.fn(),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  CartesianGrid: () => null,
  // Drive the tickFormatter for both axes so the inline arrow callbacks show
  // up in coverage. The XAxis formatter renders "{v}m", the YAxis formatter
  // produces "+/-Xk" / "0".
  XAxis: ({ tickFormatter }: { tickFormatter?: (v: number) => string }) => (
    <div data-testid="x-ticks">
      {tickFormatter ? `${tickFormatter(0)}|${tickFormatter(10)}` : ""}
    </div>
  ),
  YAxis: ({ tickFormatter }: { tickFormatter?: (v: number) => string }) => (
    <div data-testid="y-ticks">
      {tickFormatter
        ? `${tickFormatter(0)}|${tickFormatter(2500)}|${tickFormatter(-2500)}`
        : ""}
    </div>
  ),
  // Recharts Tooltip clones the `content` element and injects active/payload.
  // Mimic that so the LaneTooltip body actually renders.
  Tooltip: ({
    content,
  }: {
    content?: React.ReactElement<{
      active?: boolean;
      payload?: Array<{ payload: unknown }>;
      label?: number;
    }>;
  }) => {
    if (!content) return null;
    const samplePayload = {
      minute: 10,
      goldDiff: 750,
      csDiff: 12,
    };
    return (
      <div data-testid="lane-tooltip-stub">
        {React.cloneElement(content, {
          active: true,
          payload: [{ payload: samplePayload }],
          label: 10,
        })}
      </div>
    );
  },
  ReferenceLine: () => null,
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
    ...(teamPosition !== undefined && { teamPosition }),
  } as unknown as ParticipantDetail;
}

function mockTimeline(value: {
  participants?: Array<{ puuid: string; participantId: number }>;
  frames?: Array<{
    ts: number;
    perParticipant: Record<number, { gold: number; cs: number }>;
  }>;
  isPending?: boolean;
  isError?: boolean;
}) {
  vi.mocked(useMatchTimeline).mockReturnValue({
    data: {
      participants: value.participants ?? [],
      frames: value.frames ?? [],
    },
    isPending: value.isPending ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useMatchTimeline>);
}

function renderPhase(props: {
  myPuuid?: string;
  participants?: ParticipantDetail[];
  durationSec?: number;
}) {
  return render(
    <MotionConfig reducedMotion="always">
      <MatchLanePhase
        detail={{
          matchId: "EUW1_1",
          durationSec: props.durationSec ?? 1800,
          participants: props.participants ?? [],
        }}
        {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
      />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useMatchTimeline).mockReset();
});

describe("MatchLanePhase", () => {
  it("renders nothing without myPuuid", () => {
    mockTimeline({});
    const { container } = renderPhase({});
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for matches under 10 minutes (early surrenders / Arena)", () => {
    mockTimeline({});
    const { container } = renderPhase({ myPuuid: "me", durationSec: 300 });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for ARAM (no teamPosition)", () => {
    mockTimeline({});
    const { container } = renderPhase({
      myPuuid: "me",
      participants: [participant("me", 100)],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no opposing-team participant matches the lane", () => {
    mockTimeline({
      participants: [{ puuid: "me", participantId: 1 }],
      frames: [{ ts: 0, perParticipant: { 1: { gold: 0, cs: 0 } } }],
    });
    const { container } = renderPhase({
      myPuuid: "me",
      participants: [participant("me", 100, "MIDDLE")],
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders the Lane phase heading when timeline data and an opponent exist", () => {
    mockTimeline({
      participants: [
        { puuid: "me", participantId: 1 },
        { puuid: "opp", participantId: 6 },
      ],
      frames: [
        {
          ts: 0,
          perParticipant: {
            1: { gold: 500, cs: 0 },
            6: { gold: 500, cs: 0 },
          },
        },
        {
          ts: 600_000,
          perParticipant: {
            1: { gold: 4000, cs: 80 },
            6: { gold: 3500, cs: 75 },
          },
        },
      ],
    });
    renderPhase({
      myPuuid: "me",
      participants: [participant("me", 100, "MIDDLE"), participant("opp", 200, "MIDDLE")],
    });
    expect(screen.getByText("Lane phase")).toBeTruthy();
  });

  it("renders the pending shimmer while the timeline is loading", () => {
    mockTimeline({ isPending: true });
    const { container } = renderPhase({
      myPuuid: "me",
      participants: [participant("me", 100, "MIDDLE")],
    });
    expect(container.querySelectorAll("[class*='animate']").length).toBeGreaterThan(0);
  });
});
