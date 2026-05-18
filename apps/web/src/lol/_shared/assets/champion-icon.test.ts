import { describe, expect, it } from "vitest";
import {
  championBackdropSplashUrl,
  championCardSplashUrl,
  championIconUrl,
  championSquareIconUrl,
  itemIconUrl,
  normalizeChampionAlias,
  roleIconUrl,
  runeIconUrl,
  summonerSpellIconUrl,
} from "./champion-icon";

describe("normalizeChampionAlias", () => {
  it("strips the Swarm-mode 'Strawberry_' prefix", () => {
    expect(normalizeChampionAlias("Strawberry_Akshan")).toBe("Akshan");
  });

  it("passes regular aliases through unchanged", () => {
    expect(normalizeChampionAlias("Ahri")).toBe("Ahri");
    expect(normalizeChampionAlias("MonkeyKing")).toBe("MonkeyKing");
    expect(normalizeChampionAlias("")).toBe("");
  });
});

describe("championIconUrl", () => {
  it("lowercases the alias and routes through the /img/lol/champion proxy", () => {
    expect(championIconUrl("Ahri", "square", "26.9")).toBe(
      "http://localhost:2010/img/lol/champion/ahri/square/26.9.webp"
    );
  });

  it("strips the Swarm-mode prefix before composing the URL", () => {
    expect(championIconUrl("Strawberry_Akshan", "card", "26.9")).toBe(
      "http://localhost:2010/img/lol/champion/akshan/card/26.9.webp"
    );
  });

  it("supports every champion variant", () => {
    expect(championIconUrl("Ahri", "backdrop", "26.9")).toMatch(
      /\/backdrop\/26\.9\.webp$/
    );
  });
});

describe("variant-specific helpers", () => {
  it("championSquareIconUrl delegates to the square variant", () => {
    expect(championSquareIconUrl("Ahri", "26.9")).toBe(
      championIconUrl("Ahri", "square", "26.9")
    );
  });

  it("championCardSplashUrl delegates to the card variant", () => {
    expect(championCardSplashUrl("Ahri", "26.9")).toBe(
      championIconUrl("Ahri", "card", "26.9")
    );
  });

  it("championBackdropSplashUrl delegates to the backdrop variant", () => {
    expect(championBackdropSplashUrl("Ahri", "26.9")).toBe(
      championIconUrl("Ahri", "backdrop", "26.9")
    );
  });
});

describe("non-champion icon helpers", () => {
  it("itemIconUrl composes the patch-keyed item path", () => {
    expect(itemIconUrl(3157, "26.9")).toBe(
      "http://localhost:2010/img/lol/item/3157/26.9.webp"
    );
  });

  it("runeIconUrl composes the patch-keyed rune path", () => {
    expect(runeIconUrl(8112, "26.9")).toBe(
      "http://localhost:2010/img/lol/rune/8112/26.9.webp"
    );
  });

  it("summonerSpellIconUrl composes the patch-keyed spell path", () => {
    expect(summonerSpellIconUrl(4, "26.9")).toBe(
      "http://localhost:2010/img/lol/spell/4/26.9.webp"
    );
  });

  it("roleIconUrl is versionless (no patch in the URL)", () => {
    expect(roleIconUrl("middle")).toBe("http://localhost:2010/img/lol/role/middle.svg");
  });
});
