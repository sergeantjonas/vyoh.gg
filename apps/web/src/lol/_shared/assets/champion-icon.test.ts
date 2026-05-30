import { describe, expect, it } from "vitest";
import {
  championBackdropSplashUrl,
  championCardSplashUrl,
  championClassIconUrl,
  championHeroSplashUrl,
  championIconUrl,
  championSquareIconUrl,
  itemIconUrl,
  normalizeChampionAlias,
  rewriteWikiImageSrc,
  roleIconUrl,
  runeIconUrl,
  summonerSpellIconUrl,
  wikiFileIconUrl,
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

  it("championHeroSplashUrl delegates to the sharp splash variant", () => {
    expect(championHeroSplashUrl("Ahri", "26.9")).toBe(
      championIconUrl("Ahri", "splash", "26.9")
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
    expect(roleIconUrl("middle")).toBe("http://localhost:2010/img/lol/role/middle.webp");
  });

  it("championClassIconUrl builds the proxy URL for the DDragon-style class slug", () => {
    expect(championClassIconUrl("assassin")).toBe(
      "http://localhost:2010/img/lol/class/assassin.webp"
    );
    expect(championClassIconUrl("mage")).toBe(
      "http://localhost:2010/img/lol/class/mage.webp"
    );
  });
});

describe("wikiFileIconUrl", () => {
  it("composes a wiki-file proxy URL with the filename URL-encoded", () => {
    expect(wikiFileIconUrl("Magic_damage.png")).toBe(
      "http://localhost:2010/img/lol/wiki-file/Magic_damage.png.webp"
    );
  });

  it("percent-encodes path-reserved characters in the filename", () => {
    expect(wikiFileIconUrl("Magic damage.png")).toBe(
      "http://localhost:2010/img/lol/wiki-file/Magic%20damage.png.webp"
    );
  });
});

describe("rewriteWikiImageSrc", () => {
  it("rewrites a flat wiki upload path to the proxy", () => {
    expect(rewriteWikiImageSrc("/en-us/images/Sight_icon.png")).toBe(
      "http://localhost:2010/img/lol/wiki-file/Sight_icon.png.webp"
    );
  });

  it("strips the wiki cachebuster querystring", () => {
    expect(rewriteWikiImageSrc("/en-us/images/Sight_icon.png?0aaf0")).toBe(
      "http://localhost:2010/img/lol/wiki-file/Sight_icon.png.webp"
    );
  });

  it("rewrites a wiki thumbnail path by extracting the original filename", () => {
    expect(rewriteWikiImageSrc("/en-us/images/thumb/Dash.png/20px-Dash.png?e5c61")).toBe(
      "http://localhost:2010/img/lol/wiki-file/Dash.png.webp"
    );
  });

  it("returns null for non-wiki srcs", () => {
    expect(rewriteWikiImageSrc("https://example.com/foo.png")).toBeNull();
    expect(rewriteWikiImageSrc("/somewhere/else.png")).toBeNull();
    expect(rewriteWikiImageSrc("")).toBeNull();
  });
});
