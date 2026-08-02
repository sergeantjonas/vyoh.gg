import type { GenreShare } from "@vyoh/shared";
import { describe, expect, it } from "vitest";
import { joinGenres, leadingGenres, shareOf } from "./leading-genres";

const genre = (tag: string, share: number, gameCount: number): GenreShare => ({
  tag,
  share,
  gameCount,
  minutes: Math.round(share * 100_000),
});

describe("leadingGenres", () => {
  it("takes the leading three when all of them are carried by enough games", () => {
    const genres = [
      genre("Souls-like", 0.3, 15),
      genre("Action RPG", 0.23, 13),
      genre("Third-Person Shooter", 0.07, 10),
      genre("FPS", 0.05, 10),
    ];

    expect(leadingGenres(genres).map((g) => g.tag)).toEqual([
      "Souls-like",
      "Action RPG",
      "Third-Person Shooter",
    ]);
  });

  it("trims a trailing genre that rests on too few games", () => {
    // 434 hours of one game half a point behind a genre carried by ten: the
    // share alone cannot tell them apart, so the carrier count has to.
    const genres = [
      genre("Souls-like", 0.3, 15),
      genre("Action RPG", 0.23, 13),
      genre("Roguelite", 0.061, 1),
    ];

    expect(leadingGenres(genres).map((g) => g.tag)).toEqual(["Souls-like", "Action RPG"]);
  });

  it("keeps a thin leader so the caller can see the fingerprint is thin", () => {
    const genres = [genre("Stealth", 0.5, 1), genre("Survival", 0.5, 1)];

    expect(leadingGenres(genres).map((g) => g.tag)).toEqual(["Stealth"]);
  });

  it("returns nothing for an empty fingerprint", () => {
    expect(leadingGenres([])).toEqual([]);
  });
});

describe("joinGenres", () => {
  it("joins three with a comma and an 'and'", () => {
    expect(joinGenres([genre("A", 0.1, 5), genre("B", 0.1, 5), genre("C", 0.1, 5)])).toBe(
      "A, B and C"
    );
  });

  it("renders a single genre bare and an empty list as nothing", () => {
    expect(joinGenres([genre("A", 0.1, 5)])).toBe("A");
    expect(joinGenres([])).toBe("");
  });
});

describe("shareOf", () => {
  it("adds the shares of the genres a claim actually names", () => {
    expect(shareOf([genre("A", 0.3, 5), genre("B", 0.23, 5)])).toBeCloseTo(0.53, 10);
  });
});
