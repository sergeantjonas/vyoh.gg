import {
  MatchReviewView,
  buildHighlightChips,
  getLaningVerdict,
  getLateVerdict,
  getMidVerdict,
} from "@/lol/matches/match-review-view";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { render, screen } from "@testing-library/react";
import type {
  MatchDetail,
  MatchSummary,
  MatchTimelineProjection,
  ParticipantOwnerExtras,
  TeamSummary,
} from "@vyoh/shared";
import { configureAxe } from "jest-axe";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";

// --- Fixtures ---

function makeSummary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: "EUW1_123",
    queueType: "Ranked Solo",
    champion: "Ahri",
    kills: 5,
    deaths: 2,
    assists: 8,
    win: true,
    durationSec: 1800,
    playedAt: "2026-05-21T12:00:00Z",
    remake: false,
    teamPosition: "MIDDLE",
    gameVersion: "14.10",
    visionScore: 25,
    damageShare: 28,
    firstBloodKill: false,
    csAt10: 72,
    csAt15: 110,
    goldAt10: 3600,
    goldAt15: 5800,
    teamGoldDiffAt15: 2000,
    deathTimings: [620, 1200],
    deathXs: [],
    deathYs: [],
    killTimings: [300, 800, 1400, 1600, 1750],
    killXs: [],
    killYs: [],
    laneOpponent: null,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<MatchDetail> = {}): MatchDetail {
  return {
    matchId: "EUW1_123",
    queueType: "Ranked Solo",
    durationSec: 1800,
    playedAt: "2026-05-21T12:00:00Z",
    teams: [
      {
        teamId: 100,
        win: true,
        totalKills: 18,
        totalGold: 58000,
        objectives: {
          baron: { first: true, kills: 1 },
          champion: { first: true, kills: 18 },
          dragon: { first: true, kills: 4 },
          inhibitor: { first: true, kills: 2 },
          riftHerald: { first: true, kills: 1 },
          tower: { first: true, kills: 8 },
        },
      },
      {
        teamId: 200,
        win: false,
        totalKills: 10,
        totalGold: 45000,
        objectives: {
          baron: { first: false, kills: 0 },
          champion: { first: false, kills: 10 },
          dragon: { first: false, kills: 2 },
          inhibitor: { first: false, kills: 0 },
          riftHerald: { first: false, kills: 0 },
          tower: { first: false, kills: 2 },
        },
      },
    ],
    participants: [
      {
        puuid: "owner-puuid",
        riotIdGameName: "Ahri",
        riotIdTagline: "EUW",
        championName: "Ahri",
        teamId: 100,
        teamPosition: "MIDDLE",
        kills: 5,
        deaths: 2,
        assists: 8,
        win: true,
        items: [],
        goldEarned: 12000,
        totalDamage: 28000,
        csTotal: 200,
        csPerMin: 6.7,
        visionScore: 25,
        wardsPlaced: 10,
        wardsKilled: 3,
        controlWardsPurchased: 4,
        kp: 72,
        damageShare: 28,
        goldShare: 20,
        damageDealtPhysical: 3000,
        damageDealtMagic: 22000,
        damageDealtTrue: 3000,
        summoner1Id: 4,
        summoner2Id: 14,
        keystone: 8214,
        championLevel: 16,
        owner: {
          spellCasts: { q: 120, w: 80, e: 60, r: 20, summoner1: 4, summoner2: 3 },
          multikills: {
            double: 2,
            triple: 1,
            quadra: 0,
            penta: 0,
            killingSprees: 3,
            largestKillingSpree: 3,
          },
          survival: {
            totalDamageTaken: 18000,
            damageSelfMitigated: 2000,
            totalHeal: 1500,
            totalTimeCCDealt: 45,
            totalTimeSpentDead: 80,
            longestTimeSpentLiving: 600,
          },
          challenges: {
            maxCsAdvantageOnLaneOpponent: 18,
            maxLevelLeadLaneOpponent: 2,
            soloKills: 3,
            outnumberedKills: 1,
            survivedSingleDigitHpCount: 1,
          },
        },
      },
    ],
    ...overrides,
  };
}

// Gold diff: owner team (pids 1-5) vs enemy (pids 6-10).
// Each frame covers 1 min. 30 frames = 30 min game.
function makeTimeline(goldDiffPerFrame: number[]): MatchTimelineProjection {
  const frames = goldDiffPerFrame.map((diff, i) => {
    const perParticipant: Record<
      number,
      { gold: number; level: number; cs: number; position: { x: number; y: number } }
    > = {};
    // Owner team (pids 1-5): share diff evenly
    for (let pid = 1; pid <= 5; pid++) {
      perParticipant[pid] = {
        gold: 5000 + diff / 5,
        level: 8,
        cs: 100,
        position: { x: 5000, y: 5000 },
      };
    }
    // Enemy team (pids 6-10): base gold only
    for (let pid = 6; pid <= 10; pid++) {
      perParticipant[pid] = {
        gold: 5000,
        level: 8,
        cs: 100,
        position: { x: 10000, y: 10000 },
      };
    }
    return { ts: i * 60000, perParticipant };
  });

  return {
    matchId: "EUW1_123",
    frameIntervalMs: 60000,
    participants: [
      { participantId: 1, puuid: "owner-puuid" },
      { participantId: 2, puuid: "team-2" },
      { participantId: 3, puuid: "team-3" },
      { participantId: 4, puuid: "team-4" },
      { participantId: 5, puuid: "team-5" },
      { participantId: 6, puuid: "enemy-1" },
      { participantId: 7, puuid: "enemy-2" },
      { participantId: 8, puuid: "enemy-3" },
      { participantId: 9, puuid: "enemy-4" },
      { participantId: 10, puuid: "enemy-5" },
    ],
    frames,
    kills: [],
    objectives: [],
    buildOrders: [],
    skillOrders: [],
  };
}

// --- Verdict unit tests ---

describe("getLaningVerdict", () => {
  it("stomped bucket: maxCsAdvantage >= 25", () => {
    const result = getLaningVerdict(makeSummary({ csAt10: 80 }), {
      maxCsAdvantageOnLaneOpponent: 28,
      maxLevelLeadLaneOpponent: 1,
    });
    expect(result.verdict).toContain("Stomped lane");
    expect(result.tone).toBe("positive");
  });

  it("won bucket: maxCsAdvantage 12–24", () => {
    const result = getLaningVerdict(makeSummary({ csAt10: 70 }), {
      maxCsAdvantageOnLaneOpponent: 15,
      maxLevelLeadLaneOpponent: 1,
    });
    expect(result.verdict).toContain("Won lane");
    expect(result.tone).toBe("positive");
  });

  it("even bucket: low maxCs but decent csAt10", () => {
    const result = getLaningVerdict(makeSummary({ csAt10: 65 }), {
      maxCsAdvantageOnLaneOpponent: 5,
    });
    expect(result.verdict).toContain("Even lane");
    expect(result.tone).toBe("neutral");
  });

  it("tough bucket: low csAt10", () => {
    const result = getLaningVerdict(makeSummary({ csAt10: 45 }), {
      maxCsAdvantageOnLaneOpponent: 3,
    });
    expect(result.verdict).toContain("Tough lane");
    expect(result.tone).toBe("warning");
  });

  it("jungle: skips cs read", () => {
    const result = getLaningVerdict(makeSummary({ teamPosition: "JUNGLE" }), undefined);
    expect(result.verdict).toContain("jungle");
    expect(result.tone).toBe("neutral");
  });

  it("support: skips cs read", () => {
    const result = getLaningVerdict(makeSummary({ teamPosition: "UTILITY" }), undefined);
    expect(result.verdict).toContain("Support");
    expect(result.tone).toBe("neutral");
  });
});

describe("getMidVerdict", () => {
  it("extended: led at 14 + 25 with improving trend", () => {
    // Frames 0-29: build a series where owner is ahead at 14 and extends through 25
    const series = Array.from({ length: 30 }, (_, i) => ({
      min: i,
      diff: 1000 + i * 200, // steadily increasing lead
    }));
    const result = getMidVerdict(series, []);
    expect(result.verdict).toContain("Extended");
    expect(result.tone).toBe("positive");
  });

  it("lost lead: ahead at 14 but behind at 25", () => {
    const series = Array.from({ length: 30 }, (_, i) => ({
      min: i,
      diff: i <= 15 ? 2000 : -1000, // leads till 15 then collapses
    }));
    const result = getMidVerdict(series, [800, 900, 1000]);
    expect(result.verdict).toContain("Lost the lead");
    expect(result.tone).toBe("warning");
  });

  it("clawed back: behind at 14, ahead at 25", () => {
    const series = Array.from({ length: 30 }, (_, i) => ({
      min: i,
      diff: i < 18 ? -2000 : 1500, // behind then reverses
    }));
    const result = getMidVerdict(series, []);
    expect(result.verdict).toContain("Clawed back");
    expect(result.tone).toBe("positive");
  });
});

describe("getLateVerdict", () => {
  const objectives: TeamSummary["objectives"] = {
    baron: { first: true, kills: 1 },
    champion: { first: true, kills: 18 },
    dragon: { first: true, kills: 4 },
    inhibitor: { first: true, kills: 2 },
    riftHerald: { first: true, kills: 1 },
    tower: { first: true, kills: 8 },
  };

  it("closed: win while ahead at 25", () => {
    const series = Array.from({ length: 35 }, (_, i) => ({ min: i, diff: 2000 }));
    const result = getLateVerdict(makeSummary({ win: true }), objectives, series);
    expect(result.verdict).toMatch(/Led|closed/i);
    expect(result.tone).toBe("positive");
  });

  it("comeback win: win while behind at 25", () => {
    const series = Array.from({ length: 35 }, (_, i) => ({ min: i, diff: -2000 }));
    const result = getLateVerdict(makeSummary({ win: true }), objectives, series);
    expect(result.verdict).toContain("Fought back");
    expect(result.tone).toBe("positive");
  });

  it("threw: loss while ahead at 25", () => {
    const series = Array.from({ length: 35 }, (_, i) => ({ min: i, diff: 2000 }));
    const result = getLateVerdict(makeSummary({ win: false }), objectives, series);
    expect(result.verdict).toContain("couldn't close");
    expect(result.tone).toBe("warning");
  });

  it("closed on: loss while behind at 25", () => {
    const series = Array.from({ length: 35 }, (_, i) => ({ min: i, diff: -2000 }));
    const result = getLateVerdict(makeSummary({ win: false }), objectives, series);
    expect(result.verdict).toContain("closed out");
    expect(result.tone).toBe("warning");
  });
});

// --- buildHighlightChips unit tests ---

function makeOwner(
  overrides: Partial<ParticipantOwnerExtras> = {}
): ParticipantOwnerExtras {
  return {
    spellCasts: { q: 0, w: 0, e: 0, r: 0, summoner1: 0, summoner2: 0 },
    multikills: {
      double: 0,
      triple: 0,
      quadra: 0,
      penta: 0,
      killingSprees: 0,
      largestKillingSpree: 0,
    },
    survival: {
      totalDamageTaken: 0,
      damageSelfMitigated: 0,
      totalHeal: 0,
      totalTimeCCDealt: 0,
      totalTimeSpentDead: 0,
      longestTimeSpentLiving: 0,
    },
    challenges: {},
    ...overrides,
  };
}

describe("buildHighlightChips", () => {
  it("returns empty array when all values are below threshold", () => {
    const result = buildHighlightChips(makeOwner());
    expect(result).toHaveLength(0);
  });

  it("penta = 1 renders as 'Pentakill'", () => {
    const result = buildHighlightChips(
      makeOwner({
        multikills: {
          double: 0,
          triple: 0,
          quadra: 0,
          penta: 1,
          killingSprees: 0,
          largestKillingSpree: 0,
        },
      })
    );
    expect(result[0]?.label).toBe("Pentakill");
    expect(result[0]?.tone).toBe("positive");
  });

  it("penta > 1 renders as 'N× Pentakill'", () => {
    const result = buildHighlightChips(
      makeOwner({
        multikills: {
          double: 0,
          triple: 0,
          quadra: 0,
          penta: 2,
          killingSprees: 0,
          largestKillingSpree: 0,
        },
      })
    );
    expect(result[0]?.label).toBe("2× Pentakill");
  });

  it("soloKills=1 → singular label; soloKills=3 → plural", () => {
    const one = buildHighlightChips(makeOwner({ challenges: { soloKills: 1 } }));
    expect(one.find((c) => c.label.includes("solo kill"))?.label).toBe("1 solo kill");
    const three = buildHighlightChips(makeOwner({ challenges: { soloKills: 3 } }));
    expect(three.find((c) => c.label.includes("solo kill"))?.label).toBe("3 solo kills");
  });

  it("largestKillingSpree < 3 → no spree chip; ≥ 3 → chip present", () => {
    const below = buildHighlightChips(
      makeOwner({
        multikills: {
          double: 0,
          triple: 0,
          quadra: 0,
          penta: 0,
          killingSprees: 1,
          largestKillingSpree: 2,
        },
      })
    );
    expect(below.find((c) => c.label.includes("spree"))).toBeUndefined();
    const above = buildHighlightChips(
      makeOwner({
        multikills: {
          double: 0,
          triple: 0,
          quadra: 0,
          penta: 0,
          killingSprees: 1,
          largestKillingSpree: 5,
        },
      })
    );
    expect(above.find((c) => c.label.includes("spree"))?.label).toBe("5-kill spree");
  });

  it("enemyChampionImmobilizations < 20 → no chip; ≥ 20 → cc chip", () => {
    const below = buildHighlightChips(
      makeOwner({ challenges: { enemyChampionImmobilizations: 15 } })
    );
    expect(below.find((c) => c.label.includes("immobilization"))).toBeUndefined();
    const above = buildHighlightChips(
      makeOwner({ challenges: { enemyChampionImmobilizations: 34 } })
    );
    expect(above.find((c) => c.label.includes("immobilization"))?.tone).toBe("cc");
  });

  it("longestTimeSpentLiving < 300s → no streak; ≥ 300s → minutes shown", () => {
    const below = buildHighlightChips(
      makeOwner({
        survival: {
          totalDamageTaken: 0,
          damageSelfMitigated: 0,
          totalHeal: 0,
          totalTimeCCDealt: 0,
          totalTimeSpentDead: 0,
          longestTimeSpentLiving: 240,
        },
      })
    );
    expect(below.find((c) => c.label.includes("streak"))).toBeUndefined();
    const above = buildHighlightChips(
      makeOwner({
        survival: {
          totalDamageTaken: 0,
          damageSelfMitigated: 0,
          totalHeal: 0,
          totalTimeCCDealt: 0,
          totalTimeSpentDead: 0,
          longestTimeSpentLiving: 780,
        },
      })
    );
    expect(above.find((c) => c.label.includes("streak"))?.label).toBe("13m streak");
  });

  it("clutch survival shows correct tone", () => {
    const result = buildHighlightChips(
      makeOwner({ challenges: { survivedSingleDigitHpCount: 2 } })
    );
    const chip = result.find((c) => c.label.includes("clutch"));
    expect(chip?.label).toBe("2 clutches");
    expect(chip?.tone).toBe("survival");
  });
});

// --- MatchReviewView render tests ---

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
});

function renderReview(
  summaryOverrides: Partial<MatchSummary> = {},
  detailOverrides: Partial<MatchDetail> = {},
  goldDiffPerFrame?: number[]
) {
  const summary = makeSummary(summaryOverrides);
  const detail = makeDetail(detailOverrides);
  const timeline = goldDiffPerFrame ? makeTimeline(goldDiffPerFrame) : undefined;
  return render(
    <TooltipPrimitive.Provider>
      <MotionConfig reducedMotion="always">
        <MatchReviewView
          detail={detail}
          myPuuid="owner-puuid"
          summary={summary}
          timeline={timeline}
        />
      </MotionConfig>
    </TooltipPrimitive.Provider>
  );
}

describe("MatchReviewView", () => {
  it("renders phase verdict labels for an SR match", () => {
    renderReview();
    expect(screen.getByText("Laning")).not.toBeNull();
    expect(screen.getByText("Mid game")).not.toBeNull();
    expect(screen.getByText("Late game")).not.toBeNull();
  });

  it("renders 'Won lane' verdict for stomp scenario", () => {
    renderReview({ csAt10: 80 });
    // challenges on ownerDetail have maxCsAdvantageOnLaneOpponent: 18 → won lane
    expect(screen.getByText(/Won lane/)).not.toBeNull();
  });

  it("shows no-timeline fallback when timeline is absent", () => {
    renderReview({}, {}, undefined);
    expect(screen.getByText("No timeline data for this match.")).not.toBeNull();
  });

  it("shows unsupported queue message for ARAM", () => {
    renderReview({ queueType: "ARAM" }, { queueType: "ARAM" });
    expect(screen.getByText(/ARAM/)).not.toBeNull();
    expect(screen.queryByText("Laning")).toBeNull();
  });

  it("renders the gold lead section label when timeline is provided", () => {
    const diffs = Array.from({ length: 30 }, (_, i) => i * 300);
    renderReview({}, {}, diffs);
    expect(screen.getByText("Gold lead")).not.toBeNull();
  });

  it("renders the highlights section with chips for qualifying moments", () => {
    renderReview();
    // default fixture has triple kill + solo kills + outnumbered + spree + clutch + streak
    expect(screen.getByText("1× triple kill")).not.toBeNull();
    expect(screen.getByText("3 solo kills")).not.toBeNull();
    expect(screen.getByText("1 vs. outnumbered")).not.toBeNull();
    expect(screen.getByText("3-kill spree")).not.toBeNull();
    expect(screen.getByText("1 clutch")).not.toBeNull();
    expect(screen.getByText("10m streak")).not.toBeNull();
  });

  it("shows 'A quiet game.' when no chips clear thresholds", () => {
    const silentOwner = {
      spellCasts: { q: 0, w: 0, e: 0, r: 0, summoner1: 0, summoner2: 0 },
      multikills: {
        double: 0,
        triple: 0,
        quadra: 0,
        penta: 0,
        killingSprees: 0,
        largestKillingSpree: 0,
      },
      survival: {
        totalDamageTaken: 0,
        damageSelfMitigated: 0,
        totalHeal: 0,
        totalTimeCCDealt: 0,
        totalTimeSpentDead: 0,
        longestTimeSpentLiving: 0,
      },
      challenges: {},
    };
    renderReview(
      {},
      {
        participants: [
          {
            puuid: "owner-puuid",
            riotIdGameName: "Ahri",
            riotIdTagline: "EUW",
            championName: "Ahri",
            teamId: 100,
            teamPosition: "MIDDLE",
            kills: 0,
            deaths: 0,
            assists: 0,
            win: true,
            items: [],
            goldEarned: 0,
            totalDamage: 0,
            csTotal: 0,
            csPerMin: 0,
            visionScore: 0,
            wardsPlaced: 0,
            wardsKilled: 0,
            controlWardsPurchased: 0,
            kp: 0,
            damageShare: 0,
            goldShare: 0,
            damageDealtPhysical: 0,
            damageDealtMagic: 0,
            damageDealtTrue: 0,
            summoner1Id: 4,
            summoner2Id: 14,
            keystone: 8214,
            championLevel: 1,
            owner: silentOwner,
          },
        ],
      }
    );
    expect(screen.getByText("A quiet game.")).not.toBeNull();
  });

  it("passes axe scan", async () => {
    const { container } = renderReview();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
