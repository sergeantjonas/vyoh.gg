import { describe, expect, it } from "vitest";
import type { RecapCandidate } from "./recap-scoring.ts";
import {
  RECAP_HALF_LIFE_DAYS,
  RECAP_OFF_META_BOOST,
  RECAP_SCORE_FLOOR,
  recapScore,
  selectChapters,
} from "./recap-scoring.ts";

describe("recapScore", () => {
  it("returns baseSignal when daysSince is 0", () => {
    expect(recapScore(100, 0)).toBeCloseTo(100);
  });

  it("halves base signal after one half-life", () => {
    expect(recapScore(100, RECAP_HALF_LIFE_DAYS)).toBeCloseTo(50, 0);
  });

  it("quarters base signal after two half-lives", () => {
    expect(recapScore(100, RECAP_HALF_LIFE_DAYS * 2)).toBeCloseTo(25, 0);
  });

  it("treats negative daysSince as 0 (clock skew can't boost score)", () => {
    expect(recapScore(50, -5)).toBeCloseTo(50);
  });

  it("throws on non-finite input", () => {
    expect(() => recapScore(Number.NaN, 1)).toThrow();
    expect(() => recapScore(1, Number.POSITIVE_INFINITY)).toThrow();
  });
});

function steamSubject(
  partial: Partial<Extract<RecapCandidate, { kind: "steam-subject" }>> & {
    appid: number;
    baseSignal: number;
    daysSince: number;
  }
): RecapCandidate {
  return {
    kind: "steam-subject",
    slug: `steam-${partial.appid}`,
    name: `Game ${partial.appid}`,
    framing: null,
    ...partial,
  };
}

describe("selectChapters", () => {
  it("filters candidates below the score floor", () => {
    const result = selectChapters([
      steamSubject({ appid: 1, baseSignal: 100, daysSince: 0 }),
      steamSubject({ appid: 2, baseSignal: 1, daysSince: 0 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ appid: 1 });
  });

  it("caps Steam subjects at the configured limit", () => {
    const result = selectChapters(
      Array.from({ length: 6 }, (_, i) =>
        steamSubject({ appid: i + 1, baseSignal: 100 - i, daysSince: 0 })
      ),
      { steamSubjectCap: 3 }
    );
    expect(result).toHaveLength(3);
    expect(result.map((r) => (r.kind === "steam-subject" ? r.appid : -1))).toEqual([
      1, 2, 3,
    ]);
  });

  it("orders by score descending, breaking ties on fresher candidate", () => {
    // baseSignal × exp(-days/14) — pick two pairs that collide on score.
    const result = selectChapters(
      [
        steamSubject({ appid: 1, baseSignal: 80, daysSince: 14 }),
        steamSubject({ appid: 2, baseSignal: 40, daysSince: 0 }),
        steamSubject({ appid: 3, baseSignal: 30, daysSince: 7 }),
      ],
      { floor: 0 }
    );
    // Decayed scores: 1≈40, 2=40, 3≈18 → 1 and 2 tie at 40, fresher (2) wins.
    expect(result.map((r) => (r.kind === "steam-subject" ? r.appid : -1))).toEqual([
      2, 1, 3,
    ]);
  });

  it("emits no descriptors when nothing passes the floor", () => {
    expect(
      selectChapters([steamSubject({ appid: 1, baseSignal: 1, daysSince: 0 })])
    ).toEqual([]);
  });

  it("derives ageBucket from daysSince", () => {
    const result = selectChapters(
      [
        steamSubject({ appid: 1, baseSignal: 100, daysSince: 2 }),
        steamSubject({ appid: 2, baseSignal: 100, daysSince: 60 }),
      ],
      { floor: 0 }
    );
    const buckets = result.map((r) => r.ageBucket);
    expect(buckets).toContain("current");
    expect(buckets).toContain("season");
  });

  it("applies the off-meta boost on flagged candidates", () => {
    const result = selectChapters(
      [
        steamSubject({ appid: 1, baseSignal: 50, daysSince: 0, offMeta: true }),
        steamSubject({ appid: 2, baseSignal: 60, daysSince: 0 }),
      ],
      { floor: 0 }
    );
    // 1 boosted: 50 × 1.5 = 75 > 60; 2 stays at 60.
    expect(result[0]).toMatchObject({ appid: 1 });
    expect(result[0]?.score).toBeCloseTo(50 * RECAP_OFF_META_BOOST);
  });

  it("threads framing overrides through to the descriptor", () => {
    const result = selectChapters([
      steamSubject({
        appid: 1,
        baseSignal: 100,
        daysSince: 0,
        framing: { eyebrow: "FEATURED", title: "The one I keep returning to" },
      }),
    ]);
    expect(result[0]?.framing).toEqual({
      eyebrow: "FEATURED",
      title: "The one I keep returning to",
    });
  });

  it("preserves the lol-moment → steam-subject → steam-moment ordering across kinds", () => {
    // Platform-clustered: Ahri anchor (rendered separately above) → lol-moment
    // block → steam-subject block → steam-moment block. One LoL→Steam jump,
    // no Steam→LoL→Steam thrashing — see the cross-kind ordering rationale
    // in the file header.
    const result = selectChapters(
      [
        steamSubject({ appid: 1, baseSignal: 50, daysSince: 0 }),
        {
          kind: "lol-moment",
          slug: "moment-rank-up",
          momentType: "RANK_UP",
          baseSignal: 80,
          daysSince: 0,
        },
        {
          kind: "steam-moment",
          slug: "moment-cluster",
          momentType: "ACHIEVEMENT_CLUSTER",
          appid: 99,
          baseSignal: 70,
          daysSince: 0,
        },
      ],
      { floor: 0 }
    );
    expect(result.map((r) => r.kind)).toEqual([
      "lol-moment",
      "steam-subject",
      "steam-moment",
    ]);
  });

  it("does not let a higher-scored other-kind candidate push out a lower-scored kept kind", () => {
    // Even though the LoL moment outscores the Steam subject, both stay
    // because each falls within its kind's cap. The cross-kind interleave
    // is positional, not competitive.
    const result = selectChapters(
      [
        steamSubject({ appid: 1, baseSignal: 30, daysSince: 0 }),
        {
          kind: "lol-moment",
          slug: "rank-up",
          momentType: "RANK_UP",
          baseSignal: 200,
          daysSince: 0,
        },
      ],
      { floor: 0, steamSubjectCap: 1, lolMomentCap: 1 }
    );
    expect(result).toHaveLength(2);
  });

  it("exposes RECAP_SCORE_FLOOR as the default floor", () => {
    const justAbove = RECAP_SCORE_FLOOR + 0.01;
    const justBelow = RECAP_SCORE_FLOOR - 0.01;
    const result = selectChapters([
      steamSubject({ appid: 1, baseSignal: justAbove, daysSince: 0 }),
      steamSubject({ appid: 2, baseSignal: justBelow, daysSince: 0 }),
    ]);
    expect(result.map((r) => (r.kind === "steam-subject" ? r.appid : -1))).toEqual([1]);
  });
});
