import { describe, expect, it } from "vitest";
import {
  type ChampionRecap,
  deriveChampionRecap,
  verdictParagraph,
  verdictPreview,
} from "./champion-recap.ts";
import type { MatchSummary } from "./match.ts";

const NOW = new Date("2026-06-01T12:00:00Z");

function fixture(overrides: Partial<MatchSummary> & { matchId: string }): MatchSummary {
  return {
    queueType: "RANKED_SOLO_5x5",
    champion: "Ahri",
    kills: 6,
    deaths: 4,
    assists: 7,
    win: true,
    durationSec: 1800,
    playedAt: "2026-05-30T20:00:00Z",
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "26.9",
    visionScore: 22,
    damageShare: 0.27,
    firstBloodKill: false,
    hasTimeline: true,
    csAt10: 70,
    csAt15: 110,
    goldAt10: 4000,
    goldAt15: 6500,
    teamGoldDiffAt15: 500,
    teamGoldDiffSeries: [],
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  };
}

describe("deriveChampionRecap", () => {
  it("returns the zero-state when no matches match the alias", () => {
    const recap = deriveChampionRecap("Ahri", [], NOW);
    expect(recap.totalGames).toBe(0);
    expect(recap.winRate).toBeNull();
    expect(recap.avgKda).toBeNull();
    expect(recap.signatureGame).toBeNull();
    expect(recap.streak).toBeNull();
    expect(recap.daysSinceLastGame).toBeNull();
  });

  it("filters to the alias and excludes remakes from every aggregation", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", champion: "Ahri", win: true }),
      fixture({ matchId: "2", champion: "Ahri", win: false }),
      fixture({ matchId: "3", champion: "Yasuo", win: true, kills: 99 }),
      fixture({ matchId: "4", champion: "Ahri", remake: true, kills: 99 }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    expect(recap.totalGames).toBe(2);
    expect(recap.wins).toBe(1);
    expect(recap.losses).toBe(1);
    expect(recap.winRate).toBe(0.5);
    // Remake's 99 kills must not enter peak.
    expect(recap.peaks.highestKills).toBe(6);
  });

  it("picks the highest-kills game as the signature, KDA as tie-break", () => {
    const matches: MatchSummary[] = [
      fixture({
        matchId: "low",
        kills: 4,
        deaths: 2,
        assists: 5,
        playedAt: "2026-05-31T20:00:00Z",
      }),
      fixture({
        matchId: "tied-better-kda",
        kills: 12,
        deaths: 2,
        assists: 8,
        laneOpponent: {
          puuid: "p",
          championName: "Sylas",
          gameName: "x",
          tagLine: "y",
        },
        playedAt: "2026-05-25T20:00:00Z",
      }),
      fixture({
        matchId: "tied-worse-kda",
        kills: 12,
        deaths: 8,
        assists: 4,
        playedAt: "2026-05-29T20:00:00Z",
      }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    expect(recap.signatureGame?.matchId).toBe("tied-better-kda");
    expect(recap.signatureGame?.opponentChampion).toBe("Sylas");
    expect(recap.signatureGame?.daysAgo).toBe(6); // 25th 20:00Z → 1st 12:00Z = 160h
  });

  it("computes streak only when count >= 2", () => {
    const single = deriveChampionRecap(
      "Ahri",
      [fixture({ matchId: "a", win: true })],
      NOW
    );
    expect(single.streak).toBeNull();

    const winStreak = deriveChampionRecap(
      "Ahri",
      [
        fixture({ matchId: "old", win: false, playedAt: "2026-05-25T20:00:00Z" }),
        fixture({ matchId: "mid", win: true, playedAt: "2026-05-27T20:00:00Z" }),
        fixture({
          matchId: "new",
          win: true,
          playedAt: "2026-05-30T20:00:00Z",
        }),
      ],
      NOW
    );
    expect(winStreak.streak).toEqual({ type: "win", count: 2 });
  });

  it("computes aggression peaks correctly", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", kills: 8, firstBloodKill: true }),
      fixture({ matchId: "2", kills: 6 }),
      fixture({ matchId: "3", kills: 2 }),
      fixture({ matchId: "4", kills: 12, deaths: 0 }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    expect(recap.peaks.highestKills).toBe(12);
    expect(recap.peaks.aboveFiveKillsRate).toBe(0.75); // 3/4 above 5
    expect(recap.peaks.firstBloodRate).toBe(0.25);
    expect(recap.peaks.perfectKdaCount).toBe(1);
  });

  it("only averages gold-diff over matches with timeline data", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", hasTimeline: true, teamGoldDiffAt15: 1000 }),
      fixture({ matchId: "2", hasTimeline: false, teamGoldDiffAt15: 0 }),
      fixture({ matchId: "3", hasTimeline: true, teamGoldDiffAt15: 2000 }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    expect(recap.peaks.avgGoldDiffAt15).toBe(1500);
  });
});

describe("verdictParagraph", () => {
  it("produces the zero-state clause when no games exist", () => {
    const recap = deriveChampionRecap("Ahri", [], NOW);
    const clauses = verdictParagraph(recap);
    expect(clauses).toHaveLength(1);
    expect(verdictPreview(clauses)).toBe("No tracked Ahri games yet.");
  });

  it("calls out aggression + inconsistency when win-rate is sub-45%", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", kills: 12, win: true }),
      fixture({ matchId: "2", kills: 8, win: false }),
      fixture({ matchId: "3", kills: 10, win: false }),
      fixture({ matchId: "4", kills: 6, win: true }),
      fixture({ matchId: "5", kills: 9, win: false }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    const preview = verdictPreview(verdictParagraph(recap));
    expect(preview).toMatch(/^Aggressive, inconsistent\./);
    expect(preview).toContain("Ahri took");
    expect(preview).toContain("this season");
  });

  it("uses the new 'Best night so far: …' receipt copy with opponent name", () => {
    const matches: MatchSummary[] = [
      fixture({
        matchId: "best",
        kills: 17,
        deaths: 2,
        assists: 9,
        laneOpponent: {
          puuid: "p",
          championName: "Sylas",
          gameName: "x",
          tagLine: "y",
        },
      }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    const preview = verdictPreview(verdictParagraph(recap));
    expect(preview).toContain("Best night so far: 17/2/9 against Sylas.");
  });

  it("falls back to opponent-less framing when laneOpponent is null", () => {
    const matches: MatchSummary[] = [
      fixture({
        matchId: "best",
        kills: 17,
        deaths: 2,
        assists: 9,
        laneOpponent: null,
      }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    const preview = verdictPreview(verdictParagraph(recap));
    expect(preview).toContain("Best night so far: 17/2/9.");
    expect(preview).not.toContain("against");
  });

  it("uses the 'Struggling' verdict when KDA<1.5 and win-rate<40%, omitting the receipt", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", kills: 2, deaths: 9, assists: 3, win: false }),
      fixture({ matchId: "2", kills: 3, deaths: 8, assists: 2, win: false }),
      fixture({ matchId: "3", kills: 1, deaths: 7, assists: 4, win: false }),
      fixture({ matchId: "4", kills: 4, deaths: 6, assists: 1, win: true }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    const preview = verdictPreview(verdictParagraph(recap));
    expect(preview).toMatch(/^Struggling/);
    // No "Best night so far" — a Struggling player has no high-water mark
    // worth framing.
    expect(preview).not.toContain("Best night");
  });

  it("does not restate the aggression signal in the context clause when 'Aggressive' is the primary verdict", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", kills: 12, win: true }),
      fixture({ matchId: "2", kills: 11, win: true }),
      fixture({ matchId: "3", kills: 8, win: true }),
      fixture({ matchId: "4", kills: 9, win: false }),
      fixture({ matchId: "5", kills: 6, win: false }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    const preview = verdictPreview(verdictParagraph(recap));
    expect(preview).toMatch(/^Aggressive/);
    // The old context clause would have appended "Over five kills in X% of
    // games." — banned because that's what "Aggressive" already says.
    expect(preview).not.toContain("Over five kills");
  });

  it("emits the new volume clause with 'took N games this season; X% closed out.'", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", kills: 12, win: true }),
      fixture({ matchId: "2", kills: 8, win: false }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    const preview = verdictPreview(verdictParagraph(recap));
    expect(preview).toContain("Ahri took 2 games this season; 50% closed out.");
  });

  it("emits a win-streak context clause when on a 3+ win streak", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", win: true, playedAt: "2026-05-28T20:00:00Z" }),
      fixture({ matchId: "2", win: true, playedAt: "2026-05-29T20:00:00Z" }),
      fixture({ matchId: "3", win: true, playedAt: "2026-05-30T20:00:00Z" }),
    ];
    const recap = deriveChampionRecap("Ahri", matches, NOW);
    const preview = verdictPreview(verdictParagraph(recap));
    expect(preview).toContain("On a 3-game win streak.");
  });

  it("exposes numeric segments raw values so the JSX layer can count-up", () => {
    const matches: MatchSummary[] = [
      fixture({ matchId: "1", kills: 17, win: true }),
      fixture({ matchId: "2", kills: 12, win: true }),
      fixture({ matchId: "3", kills: 8, win: false }),
      fixture({ matchId: "4", kills: 6, win: true }),
    ];
    const recap: ChampionRecap = deriveChampionRecap("Ahri", matches, NOW);
    const clauses = verdictParagraph(recap);
    const volume = clauses[1];
    expect(volume).toBeTruthy();
    const numbers = (volume ?? []).filter((s) => s.kind === "number");
    expect(numbers.length).toBeGreaterThanOrEqual(2);
    // Total games + win-rate, raw stays as the numeric value
    expect(numbers[0]).toMatchObject({ kind: "number", raw: 4 });
    expect(numbers[1]).toMatchObject({ kind: "number", raw: 75 });
  });
});
