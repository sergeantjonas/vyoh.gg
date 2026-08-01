import { describe, expect, it } from "vitest";
import {
  PORTRAIT_GENRE_TAGS,
  isGenreTag,
  isUmbrellaGenreTag,
  selectGenreTags,
} from "./genre-tags.ts";

describe("isGenreTag", () => {
  it("accepts genres", () => {
    expect(isGenreTag("Souls-like")).toBe(true);
    expect(isGenreTag("Roguelike Deckbuilder")).toBe(true);
    expect(isGenreTag("Dating Sim")).toBe(true);
  });

  // Each of these sat in the owner's unfiltered top 25 by playtime on
  // 2026-08-01; "Singleplayer" and "Third Person" were the #2 and #3 results.
  it("rejects the descriptors that outrank real genres unfiltered", () => {
    for (const descriptor of [
      "Singleplayer",
      "Third Person",
      "Atmospheric",
      "Great Soundtrack",
      "Difficult",
      "Dark Fantasy",
      "3D",
      "Open World",
      "Violent",
      "Story Rich",
      "Co-op",
      "Multiplayer",
      "Indie",
      "Early Access",
    ]) {
      expect(isGenreTag(descriptor), descriptor).toBe(false);
    }
  });

  // The catalog stores a handful of names with trailing whitespace
  // ("Dystopian ", "Parody "), so raw string comparison would miss them.
  it("normalises whitespace and case", () => {
    expect(isGenreTag("  souls-like ")).toBe(true);
    expect(isGenreTag("RPG")).toBe(true);
  });

  it("carries no duplicates", () => {
    const normalised = PORTRAIT_GENRE_TAGS.map((tag) => tag.toLowerCase());
    expect(new Set(normalised).size).toBe(PORTRAIT_GENRE_TAGS.length);
  });
});

describe("isUmbrellaGenreTag", () => {
  it("marks the broad forms", () => {
    expect(isUmbrellaGenreTag("Action")).toBe(true);
    expect(isUmbrellaGenreTag("RPG")).toBe(true);
  });

  it("does not mark specific forms", () => {
    expect(isUmbrellaGenreTag("Action RPG")).toBe(false);
    expect(isUmbrellaGenreTag("Souls-like")).toBe(false);
  });

  it("only marks tags that are themselves genres", () => {
    for (const tag of PORTRAIT_GENRE_TAGS) {
      if (isUmbrellaGenreTag(tag)) expect(isGenreTag(tag)).toBe(true);
    }
  });
});

describe("selectGenreTags", () => {
  // Sekiro's real tag order. Unfiltered this game reports "Souls-like,
  // Difficult, Action, Third Person, Singleplayer" — four of five useless.
  it("keeps genres in weight order and drops descriptors", () => {
    expect(
      selectGenreTags([
        "Souls-like",
        "Difficult",
        "Action",
        "Third Person",
        "Singleplayer",
        "Atmospheric",
      ])
    ).toEqual(["Souls-like"]);
  });

  it("suppresses umbrellas when something more specific matched", () => {
    expect(selectGenreTags(["Action", "RPG", "Action RPG", "Souls-like"])).toEqual([
      "Action RPG",
      "Souls-like",
    ]);
  });

  it("keeps umbrellas when they are the only genre signal", () => {
    expect(selectGenreTags(["Action", "Violent", "Fast-Paced"])).toEqual(["Action"]);
  });

  it("returns nothing when every tag is a descriptor", () => {
    expect(
      selectGenreTags(["Atmospheric", "Great Soundtrack", "Female Protagonist"])
    ).toEqual([]);
  });

  // ELDEN RING NIGHTREIGN's real tag order. "Dating Sim" at rank 20 is the
  // community's joke, and it survives the allowlist because it is a perfectly
  // real genre elsewhere — only its rank gives it away.
  it("truncates the joke tail past the rank limit", () => {
    const nightreign = [
      "Souls-like",
      "Online Co-Op",
      "Multiplayer",
      "Roguelike",
      "Co-op",
      "Singleplayer",
      "PvE",
      "Action",
      "Third Person",
      "Roguelite",
      "Action RPG",
      "Open World",
      "RPG",
      "Dark",
      "Violent",
      "3D",
      "Survival",
      "Lore-Rich",
      "Story Rich",
      "Dating Sim",
    ];
    // "Roguelike" (rank 4) and "Action" (rank 8) drop as umbrellas once
    // "Roguelite" and "Action RPG" survive; "Dating Sim" drops on rank.
    expect(selectGenreTags(nightreign)).toEqual([
      "Souls-like",
      "Roguelite",
      "Action RPG",
    ]);
  });

  it("honours an explicit rank limit", () => {
    expect(selectGenreTags(["Singleplayer", "Atmospheric", "Souls-like"], 2)).toEqual([]);
    expect(selectGenreTags(["Singleplayer", "Atmospheric", "Souls-like"], 3)).toEqual([
      "Souls-like",
    ]);
  });
});
