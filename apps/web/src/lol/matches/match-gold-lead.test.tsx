import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import { render, screen } from "@testing-library/react";
import type { MatchTimelineProjection, ParticipantDetail } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MatchGoldLead } from "./match-gold-lead";

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
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

function timelineWith(
  frames: Array<{ ts: number; blueGold: number; redGold: number }>
): MatchTimelineProjection {
  return {
    frames: frames.map((f) => ({
      ts: f.ts,
      perParticipant: {
        1: { gold: f.blueGold / 5 },
        2: { gold: f.blueGold / 5 },
        3: { gold: f.blueGold / 5 },
        4: { gold: f.blueGold / 5 },
        5: { gold: f.blueGold / 5 },
        6: { gold: f.redGold / 5 },
        7: { gold: f.redGold / 5 },
        8: { gold: f.redGold / 5 },
        9: { gold: f.redGold / 5 },
        10: { gold: f.redGold / 5 },
      },
    })),
  } as unknown as MatchTimelineProjection;
}

function mockTimeline(value: {
  data?: MatchTimelineProjection;
  isPending?: boolean;
  isError?: boolean;
}) {
  vi.mocked(useMatchTimeline).mockReturnValue({
    data: value.data,
    isPending: value.isPending ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useMatchTimeline>);
}

function participant(puuid: string, teamId: 100 | 200): ParticipantDetail {
  return { puuid, teamId, championName: "Ahri" } as unknown as ParticipantDetail;
}

function renderGold(props: { myPuuid?: string; teamId?: 100 | 200 }) {
  return render(
    <MotionConfig reducedMotion="always">
      <MatchGoldLead
        detail={{
          matchId: "EUW1_1",
          participants: [participant("me", props.teamId ?? 100)],
        }}
        {...(props.myPuuid !== undefined && { myPuuid: props.myPuuid })}
      />
    </MotionConfig>
  );
}

afterEach(() => {
  vi.mocked(useMatchTimeline).mockReset();
});

describe("MatchGoldLead", () => {
  it("renders nothing when myPuuid is missing", () => {
    mockTimeline({ data: timelineWith([]) });
    const { container } = renderGold({});
    expect(container.firstChild).toBeNull();
  });

  it("renders the pending shimmer while the timeline loads", () => {
    mockTimeline({ isPending: true });
    const { container } = renderGold({ myPuuid: "me" });
    expect(container.querySelectorAll("[class*='animate']").length).toBeGreaterThan(0);
  });

  it("renders nothing when the timeline errors", () => {
    mockTimeline({ isError: true });
    const { container } = renderGold({ myPuuid: "me" });
    expect(container.firstChild).toBeNull();
  });

  it("renders the Gold lead section heading when data is present", () => {
    mockTimeline({
      data: timelineWith([
        { ts: 0, blueGold: 0, redGold: 0 },
        { ts: 60_000, blueGold: 2500, redGold: 2000 },
      ]),
    });
    renderGold({ myPuuid: "me" });
    expect(screen.getByText("Gold lead")).toBeTruthy();
  });
});
