import { describe, expect, it } from "vitest";
import { THIN_GENRE_CARRIERS, buildGenreFingerprint, isThinGenre } from "./fingerprint";

let nextAppid = 1;
const game = (minutes: number, ...tags: string[]) => ({
  appid: nextAppid++,
  name: `Game ${nextAppid}`,
  minutes,
  tags,
});

const named = (appid: number, name: string, minutes: number, ...tags: string[]) => ({
  appid,
  name,
  minutes,
  tags,
});

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

describe("genre examples", () => {
  it("names the genre's biggest carriers, longest-played first", () => {
    const { genres } = buildGenreFingerprint([
      named(1245620, "ELDEN RING", 30_000, "Souls-like"),
      named(374320, "DARK SOULS III", 12_000, "Souls-like"),
      named(814380, "Sekiro", 6_000, "Souls-like"),
      named(1113560, "NieR Replicant", 1, "Souls-like"),
    ]);

    expect(genres[0]?.examples.map((e) => e.name)).toEqual([
      "ELDEN RING",
      "DARK SOULS III",
      "Sekiro",
    ]);
  });

  it("reports each example's own playtime, not the slice this genre was given", () => {
    // 600 minutes split across two genres leaves 300 on each share, and the
    // example still says 600 — the row answers "which game", not "how much of
    // the total came from here".
    const { genres } = buildGenreFingerprint([
      named(1245620, "ELDEN RING", 600, "Souls-like", "Action RPG"),
    ]);

    expect(genres[0]?.minutes).toBe(300);
    expect(genres[0]?.examples).toEqual([
      { appid: 1245620, name: "ELDEN RING", minutes: 600 },
    ]);
  });
});

describe("isThinGenre", () => {
  it("flags a genre carried by fewer games than the threshold", () => {
    const thin = {
      tag: "Roguelite",
      minutes: 100,
      share: 0.5,
      gameCount: 1,
      examples: [],
    };
    const solid = {
      tag: "Souls-like",
      minutes: 100,
      share: 0.5,
      gameCount: THIN_GENRE_CARRIERS,
      examples: [],
    };

    expect(isThinGenre(thin)).toBe(true);
    expect(isThinGenre(solid)).toBe(false);
  });
});
