import { describe, expect, it } from "vitest";
import { THIN_GENRE_CARRIERS, buildGenreFingerprint, isThinGenre } from "./fingerprint";

const game = (minutes: number, ...tags: string[]) => ({ minutes, tags });

describe("buildGenreFingerprint", () => {
  it("divides a game's minutes across the genres it matched", () => {
    const { genres, distributedMinutes } = buildGenreFingerprint([
      game(600, "Souls-like", "Action RPG"),
    ]);

    expect(distributedMinutes).toBe(600);
    expect(genres.map((g) => [g.tag, g.minutes])).toEqual([
      ["Action RPG", 300],
      ["Souls-like", 300],
    ]);
  });

  it("keeps the shares summing to one, where repeating per tag would not", () => {
    // The same 600 minutes counted once per tag would report 300%.
    const { genres } = buildGenreFingerprint([
      game(600, "Souls-like", "Action RPG", "Third-Person Shooter"),
      game(120, "Roguelite"),
    ]);

    const total = genres.reduce((sum, g) => sum + g.share, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("drops an umbrella genre when a refinement matched the same game", () => {
    // Otherwise a top-three spends two of its slots saying "Action" twice.
    const { genres } = buildGenreFingerprint([game(600, "Action", "RPG", "Souls-like")]);

    expect(genres.map((g) => g.tag)).toEqual(["Souls-like"]);
  });

  it("keeps the umbrella when it is the only genre the game carries", () => {
    const { genres } = buildGenreFingerprint([game(600, "Atmospheric", "Action")]);

    expect(genres.map((g) => g.tag)).toEqual(["Action"]);
  });

  it("counts carriers so a share resting on one game can be told apart", () => {
    const { genres } = buildGenreFingerprint([
      game(26_040, "Roguelite"), // NIGHTREIGN alone
      game(3_000, "Third-Person Shooter"),
      game(3_000, "Third-Person Shooter"),
      game(3_000, "Third-Person Shooter"),
    ]);

    const [top, second] = genres;
    expect(top?.tag).toBe("Roguelite");
    expect(top?.gameCount).toBe(1);
    expect(second?.gameCount).toBe(3);
  });

  it("excludes games with no genre signal from the denominator and says how many", () => {
    const { distributedMinutes, gamesCounted, gamesWithoutGenre } = buildGenreFingerprint(
      [
        game(600, "Souls-like"),
        game(9_999, "Atmospheric", "Great Soundtrack"),
        game(9_999),
      ]
    );

    expect(distributedMinutes).toBe(600);
    expect(gamesCounted).toBe(1);
    expect(gamesWithoutGenre).toBe(2);
  });

  it("breaks ties alphabetically so the ranking is stable across requests", () => {
    const { genres } = buildGenreFingerprint([
      game(100, "Turn-Based Tactics"),
      game(100, "Deckbuilding"),
      game(100, "Metroidvania"),
    ]);

    expect(genres.map((g) => g.tag)).toEqual([
      "Deckbuilding",
      "Metroidvania",
      "Turn-Based Tactics",
    ]);
  });

  it("returns an empty fingerprint rather than dividing by zero", () => {
    expect(buildGenreFingerprint([])).toEqual({
      genres: [],
      distributedMinutes: 0,
      gamesCounted: 0,
      gamesWithoutGenre: 0,
    });
  });
});

describe("isThinGenre", () => {
  it("flags a genre carried by fewer games than the threshold", () => {
    const thin = { tag: "Roguelite", minutes: 100, share: 0.5, gameCount: 1 };
    const solid = {
      tag: "Souls-like",
      minutes: 100,
      share: 0.5,
      gameCount: THIN_GENRE_CARRIERS,
    };

    expect(isThinGenre(thin)).toBe(true);
    expect(isThinGenre(solid)).toBe(false);
  });
});
