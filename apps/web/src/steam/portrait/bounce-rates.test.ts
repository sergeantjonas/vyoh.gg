import type { GenreFingerprint, GenreShare } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { bounceRates, bounceShare, describeBounce } from "./bounce-rates";

const genre = (tag: string, gameCount: number): GenreShare => ({
  tag,
  gameCount,
  minutes: gameCount * 10,
  share: 0,
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

    expect(rates).toEqual([{ tag: "Action RPG", bounced: 3, tried: 16 }]);
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

  it("drops a genre carried by a single game, where a rate means nothing", () => {
    const rates = bounceRates(
      fingerprint([genre("Roguelite", 1), genre("JRPG", 2)]),
      fingerprint([])
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
    expect(describeBounce({ tag: "JRPG", bounced: 2, tried: 2 })).toBe("both");
    expect(describeBounce({ tag: "MOBA", bounced: 3, tried: 3 })).toBe("every one");
    expect(describeBounce({ tag: "FPS", bounced: 3, tried: 13 })).toBe("3");
  });
});

describe("bounceShare", () => {
  it("does not divide by zero", () => {
    expect(bounceShare({ tag: "None", bounced: 0, tried: 0 })).toBe(0);
    expect(bounceShare({ tag: "JRPG", bounced: 2, tried: 2 })).toBe(1);
  });
});
