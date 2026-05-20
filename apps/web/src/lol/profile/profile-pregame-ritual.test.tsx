import { useSeriousMatches } from "@/lol/_shared/serious-queues/serious-queues";
import { render, screen } from "@testing-library/react";
import {
  type MatchSummary,
  type PregameCalibrationByQueue,
  emptyBySignal,
} from "@vyoh/shared";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePregameRitual } from "./profile-pregame-ritual";
import { usePregameCalibration } from "./use-pregame-calibration";

vi.mock("@/lol/_shared/serious-queues/serious-queues", () => ({
  useSeriousMatches: vi.fn(),
  useSeriousQueues: () => ({ ids: new Set([420, 440]), set: () => {} }),
}));

vi.mock("@/lol/_shared/account/use-account-from-slug", () => ({
  useAccountFromSlug: () => ({
    slug: "ahri",
    region: "euw1",
    gameName: "Ahri",
    tagLine: "EUW",
  }),
}));

vi.mock("./use-pregame-calibration", () => ({
  usePregameCalibration: vi.fn(),
}));

vi.mock("@/lol/champions/use-champions", () => ({
  useChampionName: () => (alias: string) => alias,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...(props as Record<string, unknown>)}>{children}</a>
  ),
}));

vi.mock("@/lol/_shared/assets/champion-square-icon", () => ({
  ChampionSquareIcon: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function setMatches(matches: MatchSummary[] | undefined, isPending = false) {
  vi.mocked(useSeriousMatches).mockReturnValue({ matches, isPending });
}

function setCalibration(byQueue: PregameCalibrationByQueue | undefined) {
  vi.mocked(usePregameCalibration).mockReturnValue({
    data: byQueue,
  } as unknown as ReturnType<typeof usePregameCalibration>);
}

beforeEach(() => {
  setCalibration({});
});

function renderRitual() {
  return render(
    <MotionConfig reducedMotion="always">
      <ProfilePregameRitual accountSlug="ahri" />
    </MotionConfig>
  );
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function fakeMatch(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: `M${Math.random()}`,
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 4,
    assists: 8,
    win: true,
    durationSec: 1800,
    playedAt: new Date(Date.now() - 24 * HOUR_MS).toISOString(),
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "14.20.586.5840",
    visionScore: 20,
    damageShare: 0.2,
    firstBloodKill: false,
    csAt10: 70,
    csAt15: 110,
    goldAt10: 4000,
    goldAt15: 6000,
    teamGoldDiffAt15: 0,
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  } as unknown as MatchSummary;
}

afterEach(() => {
  vi.mocked(useSeriousMatches).mockReset();
  vi.mocked(usePregameCalibration).mockReset();
  vi.useRealTimers();
});

describe("ProfilePregameRitual", () => {
  it("renders nothing when there are no matches", () => {
    setMatches([]);
    const { container } = renderRitual();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while the matches query is pending (undefined data)", () => {
    setMatches(undefined, true);
    const { container } = renderRitual();
    expect(container.firstChild).toBeNull();
  });

  it("renders all four signal tiles when matches are available", () => {
    setMatches([fakeMatch()]);
    renderRitual();
    expect(screen.getByText("Pre-game")).toBeTruthy();
    expect(screen.getByText("Form")).toBeTruthy();
    expect(screen.getByText("After last game")).toBeTruthy();
    expect(screen.getByText("Time slot")).toBeTruthy();
    // Champion tile label varies (Champion vs Most played) depending on data.
    expect(
      screen.queryByText("Champion") ?? screen.queryByText("Most played")
    ).toBeTruthy();
  });

  it("reports a streak when consecutive recent games share an outcome", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/On a 3-game win streak\./)).toBeTruthy();
  });

  it("reports the loss-streak phrasing for a losing run", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: false, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/On a 2-game loss streak\./)).toBeTruthy();
  });

  it("reads 'Last game was a win.' when only one recent game and it was a win", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Last game was a win\./)).toBeTruthy();
  });

  it("reports the most-played champion verdict when ≥1 recent game exists", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({
        win: true,
        playedAt: new Date(now - DAY_MS).toISOString(),
        champion: "Ahri",
      }),
      fakeMatch({
        win: false,
        playedAt: new Date(now - 2 * DAY_MS).toISOString(),
        champion: "Ahri",
      }),
      fakeMatch({
        win: true,
        playedAt: new Date(now - 3 * DAY_MS).toISOString(),
        champion: "Lux",
      }),
    ]);
    renderRitual();
    expect(screen.getByText(/Ahri — 2g · 50% WR/)).toBeTruthy();
    expect(screen.getByText(/Last 14 days/)).toBeTruthy();
  });

  it("falls back to 'No games in the last 14 days' for the champion tile when all matches are older than the window", () => {
    const tooOld = new Date(Date.now() - 30 * DAY_MS).toISOString();
    setMatches([fakeMatch({ playedAt: tooOld })]);
    renderRitual();
    expect(screen.getByText(/No games in the last 14 days\./)).toBeTruthy();
  });

  it("reports the 'need more games' tilt verdict when fewer than 5 played games exist", () => {
    setMatches([fakeMatch()]);
    renderRitual();
    expect(screen.getByText(/Need a few more games to read\./)).toBeTruthy();
  });

  it("reports the 'untested hour' time-slot verdict when fewer than 10 games exist", () => {
    setMatches([fakeMatch()]);
    renderRitual();
    expect(screen.getByText(/Need more games to read your hours\./)).toBeTruthy();
  });

  it("renders a composite read banner when at least one signal fires", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Composite read · next/)).toBeTruthy();
  });

  it("renders the empty composite when no signal fires", () => {
    setMatches([fakeMatch({ remake: true })]);
    renderRitual();
    expect(screen.getByText(/Play a few games and we'll have a read\./)).toBeTruthy();
  });

  it("reports 'not enough games after a win' when ≥5 total but <3 after-win games", () => {
    const now = Date.now();
    // 5 games total: last 4 were losses (the "after-loss" bucket is fine);
    // last game won, but the after-win bucket only has the games following
    // wins in history — with only one win at the top, there are 0 after-win.
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - 1 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 3 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 4 * DAY_MS).toISOString() }),
      fakeMatch({ win: false, playedAt: new Date(now - 5 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Not enough games after a win yet\./)).toBeTruthy();
  });

  it("reports a warning after-loss verdict when the bucket WR trails overall by ≥5pp", () => {
    const now = Date.now();
    // 5 wins (oldest) → 5 losses (newest). Chronologically: W W W W W L L L L L.
    // afterLoss: 4 games / 0 wins = 0%. Overall: 5/10 = 50%. Delta -50pp → warning.
    const wins = [true, true, true, true, true, false, false, false, false, false];
    setMatches(
      wins.map((win, i) =>
        fakeMatch({
          // Newest first to match the chronological pattern above.
          playedAt: new Date(now - (wins.length - i) * HOUR_MS).toISOString(),
          win,
        })
      )
    );
    renderRitual();
    expect(
      screen.getByText(/After a loss your WR drops to 0% \(vs\. 50% overall\)\./)
    ).toBeTruthy();
  });

  it("reads 'Last game was a loss.' when only one recent game and it was a loss", () => {
    const now = Date.now();
    // Alternating outcomes ⇒ no streak ⇒ falls through to last-game branch.
    setMatches([
      fakeMatch({ win: false, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/Last game was a loss\./)).toBeTruthy();
  });

  it("reports a positive after-win verdict when the bucket WR beats overall by ≥5pp", () => {
    const now = Date.now();
    // 5 losses (oldest) → 5 wins (newest). Chronologically: L L L L L W W W W W.
    // afterWin: 4 games / 4 wins = 100%. Overall: 5/10 = 50%. Delta +50pp → positive.
    const wins = [false, false, false, false, false, true, true, true, true, true];
    setMatches(
      wins.map((win, i) =>
        fakeMatch({
          playedAt: new Date(now - (wins.length - i) * HOUR_MS).toISOString(),
          win,
        })
      )
    );
    renderRitual();
    expect(
      screen.getByText(/After a win your WR climbs to 100% \(vs\. 50% overall\)\./)
    ).toBeTruthy();
  });

  it("renders the champion verdict with a positive tone when the top champion beats overall by ≥5pp", () => {
    const now = Date.now();
    // 3 wins on Ahri + 2 losses on Lux → overall 60%, Ahri (most-played) at 100%.
    setMatches([
      fakeMatch({
        champion: "Ahri",
        win: true,
        playedAt: new Date(now - DAY_MS).toISOString(),
      }),
      fakeMatch({
        champion: "Ahri",
        win: true,
        playedAt: new Date(now - 2 * DAY_MS).toISOString(),
      }),
      fakeMatch({
        champion: "Ahri",
        win: true,
        playedAt: new Date(now - 3 * DAY_MS).toISOString(),
      }),
      fakeMatch({
        champion: "Lux",
        win: false,
        playedAt: new Date(now - 4 * DAY_MS).toISOString(),
      }),
      fakeMatch({
        champion: "Lux",
        win: false,
        playedAt: new Date(now - 5 * DAY_MS).toISOString(),
      }),
    ]);
    renderRitual();
    expect(screen.getByText(/Ahri — 3g · 100% WR/)).toBeTruthy();
  });

  it("renders the time-slot tile when matches reach the ≥10-game threshold", () => {
    const now = Date.now();
    setMatches(
      Array.from({ length: 12 }, (_, i) =>
        fakeMatch({
          win: i % 2 === 0,
          playedAt: new Date(now - (i + 1) * HOUR_MS).toISOString(),
        })
      )
    );
    renderRitual();
    // With 12 alternating games at arbitrary hours, no specific slot reaches
    // the MIN_HOUR_SAMPLE threshold — the "Untested hour" verdict surfaces.
    expect(screen.getByText(/Untested hour for you/)).toBeTruthy();
  });

  it("renders the 'How is this computed?' disclosure alongside a fired composite", () => {
    const now = Date.now();
    setMatches([
      fakeMatch({ win: true, playedAt: new Date(now - DAY_MS).toISOString() }),
      fakeMatch({ win: true, playedAt: new Date(now - 2 * DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/How is this computed\?/)).toBeTruthy();
  });

  it("falls back to the heuristic confidence string when the LP-history sample is too small", () => {
    const now = Date.now();
    // Single loss ⇒ only the form signal fires (WR=0% leaves champion neutral;
    // tilt + slot need more history). With zero snapshotLpBefore/snapshotLp
    // pairs the calibration sample is 0 < 30 and LP1's heuristic flows through.
    setMatches([
      fakeMatch({ win: false, playedAt: new Date(now - DAY_MS).toISOString() }),
    ]);
    renderRitual();
    expect(screen.getByText(/low confidence — small sample/)).toBeTruthy();
  });

  it("surfaces calibration text from the most-recent match's queue (active queue)", () => {
    const now = Date.now();
    // Two Solo matches — most recent is Solo, so the active queue is Solo
    // even though Flex would beat it on sample size in the calibration below.
    setMatches([
      fakeMatch({
        queueType: "Ranked Solo",
        win: true,
        playedAt: new Date(now - DAY_MS).toISOString(),
      }),
      fakeMatch({
        queueType: "Ranked Solo",
        win: true,
        playedAt: new Date(now - 2 * DAY_MS).toISOString(),
      }),
    ]);
    setCalibration({
      "Ranked Solo": {
        n: 50,
        directionalHits: 30,
        directionalAccuracy: 0.6,
        meanLpForPositive: 8,
        meanLpForNegative: -6,
        meanLpForNeutral: 0,
        bySignal: emptyBySignal(),
      },
      "Ranked Flex": {
        n: 10,
        directionalHits: 6,
        directionalAccuracy: 0.6,
        meanLpForPositive: null,
        meanLpForNegative: null,
        meanLpForNeutral: null,
        bySignal: emptyBySignal(),
      },
    });
    renderRitual();
    expect(screen.getByText("Composite read · next Ranked Solo")).toBeTruthy();
    expect(screen.getByText(/last 50 Ranked Solo games/)).toBeTruthy();
    expect(screen.getByText(/60% directional · n=50/)).toBeTruthy();
    expect(screen.getByText(/n=10 \(need 30\)/)).toBeTruthy();
  });

  it("scopes the headline to the queue of the most recent match, even when another queue has a larger sample", () => {
    const now = Date.now();
    // Most recent match is Flex — even though Solo has 200 games of backtest
    // history and Flex only has 35, the prediction is "next Flex" so we use
    // the Flex calibration for the headline.
    setMatches([
      fakeMatch({
        queueType: "Ranked Flex",
        win: true,
        playedAt: new Date(now - HOUR_MS).toISOString(),
      }),
      fakeMatch({
        queueType: "Ranked Solo",
        win: true,
        playedAt: new Date(now - DAY_MS).toISOString(),
      }),
    ]);
    setCalibration({
      "Ranked Solo": {
        n: 200,
        directionalHits: 120,
        directionalAccuracy: 0.6,
        meanLpForPositive: 18,
        meanLpForNegative: -16,
        meanLpForNeutral: 0,
        bySignal: emptyBySignal(),
      },
      "Ranked Flex": {
        n: 35,
        directionalHits: 21,
        directionalAccuracy: 0.6,
        meanLpForPositive: 12,
        meanLpForNegative: -10,
        meanLpForNeutral: 0,
        bySignal: emptyBySignal(),
      },
    });
    renderRitual();
    expect(screen.getByText("Composite read · next Ranked Flex")).toBeTruthy();
    expect(screen.getByText(/last 35 Ranked Flex games/)).toBeTruthy();
  });

  it("labels the verdict with the most-recent queue even when calibration is empty (no LP snapshots yet)", () => {
    const now = Date.now();
    // Two Flex matches with no LP snapshots → API returns {} for byQueue,
    // but the prediction is still "next Ranked Flex" because that's what
    // the user is about to queue.
    setMatches([
      fakeMatch({
        queueType: "Ranked Flex",
        win: true,
        playedAt: new Date(now - HOUR_MS).toISOString(),
      }),
      fakeMatch({
        queueType: "Ranked Flex",
        win: true,
        playedAt: new Date(now - DAY_MS).toISOString(),
      }),
    ]);
    setCalibration({});
    renderRitual();
    expect(screen.getByText("Composite read · next Ranked Flex")).toBeTruthy();
  });

  it("uses the active queue's meanLpFor* for the band center once N >= 30", () => {
    const now = Date.now();
    // Three same-queue wins → form signal positive, champion signal positive
    // (Ahri 100% WR over 14 days), score >= 0.25 → positive bucket.
    setMatches([
      fakeMatch({
        queueType: "Ranked Solo",
        win: true,
        playedAt: new Date(now - DAY_MS).toISOString(),
      }),
      fakeMatch({
        queueType: "Ranked Solo",
        win: true,
        playedAt: new Date(now - 2 * DAY_MS).toISOString(),
      }),
      fakeMatch({
        queueType: "Ranked Solo",
        win: true,
        playedAt: new Date(now - 3 * DAY_MS).toISOString(),
      }),
    ]);
    setCalibration({
      "Ranked Solo": {
        n: 80,
        directionalHits: 56,
        directionalAccuracy: 0.7,
        // Player gains ~14 LP on average when the composite reads positive
        // — different from the heuristic which would predict +20 here.
        meanLpForPositive: 14,
        meanLpForNegative: -18,
        meanLpForNeutral: 0,
        bySignal: emptyBySignal(),
      },
    });
    renderRitual();
    // Center 14, band 14 ± 5 → +9 to +19.
    expect(screen.getByText("+9 to +19 LP")).toBeTruthy();
  });
});
