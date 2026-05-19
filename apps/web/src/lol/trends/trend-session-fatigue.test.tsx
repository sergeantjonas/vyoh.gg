import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type { MatchSummary } from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { TrendSessionFatigue } from "./trend-session-fatigue";

// Sessions cluster when gaps between matches are < 30 min. Inside a session,
// games at positions 0,1,2,3+ get bucketed into G1/G2/G3/G4+.
function match(
  isoStart: string,
  win: boolean,
  idx: number,
  durationSec = 1800
): MatchSummary {
  return {
    matchId: `M_${idx}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 0,
    deaths: 0,
    assists: 0,
    win,
    durationSec,
    playedAt: isoStart,
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "16.9.1.1",
    visionScore: 0,
    damageShare: 0,
    firstBloodKill: false,
    csAt10: 0,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
  };
}

function session(
  sessionIdx: number,
  wins: boolean[],
  baseStartMs = Date.UTC(2026, 0, 1, 12)
): MatchSummary[] {
  // Each session starts 1 day apart so gaps are > 30 min between sessions
  // but games within a session are stamped 31 min apart with 30-min durations
  // (i.e. gap=1min < SESSION_GAP_MS).
  const startMs = baseStartMs + sessionIdx * 24 * 60 * 60 * 1000;
  return wins.map((w, i) =>
    match(new Date(startMs + i * 31 * 60 * 1000).toISOString(), w, sessionIdx * 100 + i)
  );
}

function renderTile(matches: MatchSummary[]) {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipPrimitive.Provider>
        <TrendSessionFatigue current={matches} previous={[]} />
      </TooltipPrimitive.Provider>
    </MotionConfig>
  );
}

describe("TrendSessionFatigue", () => {
  it("renders the not-enough-sessions empty state under MIN_LONG_SESSIONS", () => {
    // 4 long sessions (need 5+).
    const matches = [
      ...session(0, [true, true, true, true]),
      ...session(1, [true, true, true, true]),
      ...session(2, [true, true, true, true]),
      ...session(3, [true, true, true, true]),
    ];
    renderTile(matches);
    expect(
      screen.getByText("Need 5+ sessions of 4 games or more to detect fatigue patterns.")
    ).toBeTruthy();
  });

  it("emits the 'no fatigue' verdict when G1 and G4+ WRs are within the threshold", () => {
    // 5 long sessions, every game a win → G1 = 100%, G4+ = 100% → drop = 0.
    const matches = [
      ...session(0, [true, true, true, true]),
      ...session(1, [true, true, true, true]),
      ...session(2, [true, true, true, true]),
      ...session(3, [true, true, true, true]),
      ...session(4, [true, true, true, true]),
    ];
    renderTile(matches);
    expect(
      screen.getByText("Win rate holds at 100% in game 4+ — no clear fatigue pattern.")
    ).toBeTruthy();
    expect(screen.queryByText("Three-game cap?")).toBeNull();
  });

  it("emits the fatigue verdict and three-game-cap prescription on a clear drop", () => {
    // G1 all wins, G2/G3/G4+ all losses → big drop.
    const matches = [
      ...session(0, [true, false, false, false]),
      ...session(1, [true, false, false, false]),
      ...session(2, [true, false, false, false]),
      ...session(3, [true, false, false, false]),
      ...session(4, [true, false, false, false]),
    ];
    renderTile(matches);
    expect(
      screen.getByText(
        "Win rate drops to 0% from game 4 onward — down from 100% at game 1."
      )
    ).toBeTruthy();
    expect(screen.getByText("Three-game cap?")).toBeTruthy();
  });
});
