import type { GenreFingerprint, GenreShare } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { bounceRates, bounceShare, describeBounce } from "./bounce-rates";

const genre = (tag: string, gameCount: number): GenreShare => ({
  tag,
  gameCount,
  minutes: gameCount * 10,
  share: 0,
  examples: [{ appid: gameCount, name: `A ${tag}`, minutes: 10 }],
});

const fingerprint = (genres: GenreShare[]): GenreFingerprint => ({
  genres,
  distributedMinutes: genres.reduce((sum, g) => sum + g.minutes, 0),
  gamesCounted: genres.length,
  gamesWithoutGenre: 0,
});

describe("bounceRates", () => {
  it("adds the abandoned carriers to the played ones for the denominator", () => {
    // The lifetime fingerprint counts games that cleared the floor, so a genre
    // tried 16 times and bounced 3 shows up as 13 there, not 16.
    const rates = bounceRates(
      fingerprint([genre("Action RPG", 3)]),
      fingerprint([genre("Action RPG", 13)])
    );

    expect(rates).toEqual([
      {
        tag: "Action RPG",
        bounced: 3,
        tried: 16,
        // The dropped games come off the tasted fingerprint, which is the one
        // whose carriers are by definition the abandonments.
        dropped: [{ appid: 3, name: "A Action RPG", minutes: 10 }],
      },
    ]);
  });

  it("ranks by rate rather than by volume", () => {
    const rates = bounceRates(
      fingerprint([genre("Action RPG", 3), genre("JRPG", 2)]),
      fingerprint([genre("Action RPG", 13), genre("JRPG", 0)])
    );

    // Two bounces out of two beats three out of sixteen, which is the whole
    // point of joining the fingerprints instead of ranking the tasted one.
    expect(rates.map((rate) => rate.tag)).toEqual(["JRPG", "Action RPG"]);
  });

  it("drops a genre resting on one abandoned game, where a rate is an anecdote", () => {
    // Roguelite is a true 100% and Psychological Horror a true 50%; both rest
    // on a single abandonment, and neither is a pattern.
    const rates = bounceRates(
      fingerprint([
        genre("Roguelite", 1),
        genre("Psychological Horror", 1),
        genre("JRPG", 2),
      ]),
      fingerprint([genre("Psychological Horror", 1)])
    );

    expect(rates.map((rate) => rate.tag)).toEqual(["JRPG"]);
  });

  it("keeps the list short enough to read", () => {
    const tasted = fingerprint(
      ["A", "B", "C", "D", "E"].map((tag, index) => genre(tag, 5 - index))
    );

    expect(bounceRates(tasted, fingerprint([]))).toHaveLength(3);
  });

  it("returns nothing rather than throwing on an empty cohort", () => {
    expect(bounceRates(fingerprint([]), fingerprint([]))).toEqual([]);
  });
});

describe("describeBounce", () => {
  it("says 'both' when a pair was tried and a pair was dropped", () => {
    expect(describeBounce({ tag: "JRPG", bounced: 2, tried: 2, dropped: [] })).toBe(
      "both"
    );
    expect(describeBounce({ tag: "MOBA", bounced: 3, tried: 3, dropped: [] })).toBe(
      "every one"
    );
    expect(describeBounce({ tag: "FPS", bounced: 3, tried: 13, dropped: [] })).toBe("3");
  });
});

describe("bounceShare", () => {
  it("does not divide by zero", () => {
    expect(bounceShare({ tag: "None", bounced: 0, tried: 0, dropped: [] })).toBe(0);
    expect(bounceShare({ tag: "JRPG", bounced: 2, tried: 2, dropped: [] })).toBe(1);
  });
});
