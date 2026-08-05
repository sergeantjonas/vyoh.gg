import { describe, expect, it } from "vitest";
import {
  ANCIENT_PENALTY,
  type BacklogCandidate,
  type BacklogContext,
  scoreCandidate,
  selectBacklogCandidates,
  selectHighestRegret,
  selectPickUpNext,
  selectSleepingGenre,
} from "./backlog";
import { buildGenreFingerprint } from "./fingerprint";

const game = (
  appid: number,
  name: string,
  tags: string[],
  playtimeForeverMinutes = 0,
  releaseDate: Date | null = null
): BacklogCandidate => ({ appid, name, tags, releaseDate, playtimeForeverMinutes });

// A portrait anchored in Souls-likes, with a long tail of Third-Person Shooter.
const PORTRAIT = buildGenreFingerprint([
  { appid: 1, name: "ELDEN RING", minutes: 30_000, tags: ["Souls-like"] },
  { appid: 2, name: "Sekiro", minutes: 9_000, tags: ["Souls-like"] },
  { appid: 3, name: "PUBG", minutes: 3_000, tags: ["Third-Person Shooter"] },
]);

const CONTEXT: BacklogContext = { fingerprint: PORTRAIT, referenceYear: 2026 };

describe("scoreCandidate", () => {
  it("scores by the share of the portrait a game's genres account for", () => {
    // Souls-like holds 30/42 of the distributed minutes; Third-Person Shooter
    // holds 3/42. Two thin genres must not outrank one thick one.
    const thick = scoreCandidate(game(9, "Lies of P", ["Souls-like"]), CONTEXT);
    const thin = scoreCandidate(game(10, "Remnant", ["Third-Person Shooter"]), CONTEXT);

    expect(thick.score).toBeGreaterThan(thin.score);
    expect(thick.matched).toEqual(["Souls-like"]);
  });

  it("names every genre the game carries, so the reason can say '1 of 2'", () => {
    const scored = scoreCandidate(
      game(11, "Nioh", ["Souls-like", "Deckbuilding"]),
      CONTEXT
    );

    expect(scored.matched).toEqual(["Souls-like"]);
    expect(scored.genreCount).toBe(2);
  });

  it("penalises an ancient game only when nothing at all overlaps", () => {
    const oldMatched = scoreCandidate(
      game(12, "Dark Souls", ["Souls-like"], 0, new Date("2011-09-22")),
      CONTEXT
    );
    const oldUnmatched = scoreCandidate(
      game(13, "Bundle Filler", ["Deckbuilding"], 0, new Date("2011-09-22")),
      CONTEXT
    );

    expect(oldMatched.score).toBeGreaterThan(0);
    expect(oldUnmatched.score).toBe(-ANCIENT_PENALTY);
  });

  it("scores the same on both sides of the wire, given no reference year", () => {
    // The age penalty is the only clock-dependent term, and a null reference
    // year disables it rather than guessing — a score that differed between the
    // server render and hydration would discard the tree.
    const scored = scoreCandidate(
      game(14, "Bundle Filler", ["Deckbuilding"], 0, new Date("1998-01-01")),
      { fingerprint: PORTRAIT, referenceYear: null }
    );

    expect(scored.score).toBe(0);
  });
});

describe("selectBacklogCandidates", () => {
  it("keeps only owned games that were never launched and carry a genre", () => {
    const kept = selectBacklogCandidates([
      game(1, "Untouched", ["Souls-like"]),
      game(2, "Played once", ["Souls-like"], 12),
      game(3, "No genre at all", ["Atmospheric", "Great Soundtrack"]),
    ]);

    expect(kept.map((g) => g.name)).toEqual(["Untouched"]);
  });
});

describe("selectPickUpNext", () => {
  it("returns the untouched game closest to what the portrait already is", () => {
    const pick = selectPickUpNext(
      [
        game(20, "Remnant II", ["Third-Person Shooter"]),
        game(21, "Lies of P", ["Souls-like"]),
      ],
      CONTEXT
    );

    expect(pick?.candidate.name).toBe("Lies of P");
  });

  it("returns nothing rather than recommending a game with no overlap", () => {
    expect(selectPickUpNext([game(22, "Balatro", ["Deckbuilding"])], CONTEXT)).toBeNull();
  });
});

describe("selectSleepingGenre", () => {
  it("weighs the pile against the portrait, not the pile alone", () => {
    // Third-Person Shooter has three waiting to Souls-like's two, and would
    // win on count — but it holds 3/42 of the portrait against Souls-like's
    // 30/42, so almost none of what is going unplayed is a shooter.
    const sleeping = selectSleepingGenre(
      [
        game(30, "Lies of P", ["Souls-like"]),
        game(31, "Nioh 2", ["Souls-like"]),
        game(32, "Remnant II", ["Third-Person Shooter"]),
        game(33, "Warframe", ["Third-Person Shooter"]),
        game(34, "Helldivers", ["Third-Person Shooter"]),
      ],
      CONTEXT
    );

    expect(sleeping?.tag).toBe("Souls-like");
    expect(sleeping?.untouchedCount).toBe(2);
  });

  it("names the newest of the waiting games rather than the alphabetical first", () => {
    const sleeping = selectSleepingGenre(
      [
        game(35, "Aardvark Souls", ["Souls-like"], 0, new Date("2015-01-01")),
        game(36, "Zenith of Ash", ["Souls-like"], 0, new Date("2025-01-01")),
      ],
      CONTEXT
    );

    expect(sleeping?.games.map((g) => g.name)).toEqual([
      "Zenith of Ash",
      "Aardvark Souls",
    ]);
  });

  it("leaves the pick out of the sample but not out of the count", () => {
    const sleeping = selectSleepingGenre(
      [game(37, "Lies of P", ["Souls-like"]), game(38, "Nioh 2", ["Souls-like"])],
      CONTEXT,
      37
    );

    expect(sleeping?.untouchedCount).toBe(2);
    expect(sleeping?.games.map((g) => g.name)).toEqual(["Nioh 2"]);
  });

  it("refuses to call one waiting game a pattern", () => {
    const sleeping = selectSleepingGenre(
      [game(33, "Lies of P", ["Souls-like"])],
      CONTEXT
    );

    expect(sleeping).toBeNull();
  });

  it("ignores a genre the portrait does not carry, however many are waiting", () => {
    const sleeping = selectSleepingGenre(
      [
        game(34, "Balatro", ["Deckbuilding"]),
        game(35, "Slay the Spire", ["Deckbuilding"]),
        game(36, "Monster Train", ["Deckbuilding"]),
      ],
      CONTEXT
    );

    expect(sleeping).toBeNull();
  });
});

describe("selectHighestRegret", () => {
  it("ranks abandoned games by how much of the portrait they account for", () => {
    const regret = selectHighestRegret(
      [
        game(40, "Remnant", ["Third-Person Shooter"], 15),
        game(41, "Mortal Shell", ["Souls-like"], 22),
      ],
      CONTEXT
    );

    expect(regret?.candidate.name).toBe("Mortal Shell");
  });

  it("returns nothing when no abandoned game matches the portrait", () => {
    expect(
      selectHighestRegret([game(42, "Balatro", ["Deckbuilding"], 9)], CONTEXT)
    ).toBeNull();
  });
});
