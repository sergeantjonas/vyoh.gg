import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  wikiAbilityIconUrl,
  wikiAttackIconUrl,
  wikiChampionSquareUrl,
  wikiEntryIconUrl,
  wikiFileUrl,
  wikiGoldIconUrl,
  wikiMinimapUrl,
  wikiMinionIconUrl,
  wikiPingUrl,
  wikiRankedEmblemUrl,
  wikiStatIconUrl,
  wikiWardIconUrl,
} from "./wiki-url-helpers";

const BASE = "https://wiki.leagueoflegends.com/en-us/images";

describe("wikiEntryIconUrl", () => {
  it("builds an item URL", () => {
    expect(wikiEntryIconUrl("Infinity Edge", "item")).toBe(
      `${BASE}/Infinity_Edge_item.png`
    );
  });

  it("builds a rune URL", () => {
    expect(wikiEntryIconUrl("Phase Rush", "rune")).toBe(`${BASE}/Phase_Rush_rune.png`);
  });

  it("encodes apostrophes as %27", () => {
    expect(wikiEntryIconUrl("Rabadon's Deathcap", "item")).toBe(
      `${BASE}/Rabadon%27s_Deathcap_item.png`
    );
  });
});

describe("wikiChampionSquareUrl", () => {
  it("builds the canonical square URL", () => {
    expect(wikiChampionSquareUrl("Annie")).toBe(`${BASE}/Annie_OriginalSquare.png`);
  });

  it("preserves multi-word names with underscores", () => {
    expect(wikiChampionSquareUrl("Jarvan IV")).toBe(
      `${BASE}/Jarvan_IV_OriginalSquare.png`
    );
  });

  it("encodes apostrophes", () => {
    expect(wikiChampionSquareUrl("Kai'Sa")).toBe(`${BASE}/Kai%27Sa_OriginalSquare.png`);
  });
});

describe("wikiAbilityIconUrl", () => {
  it("builds a champion+ability URL", () => {
    expect(wikiAbilityIconUrl("Annie", "Disintegrate")).toBe(
      `${BASE}/Annie_Disintegrate.png`
    );
  });

  it("handles multi-word champion and ability names", () => {
    expect(wikiAbilityIconUrl("Jarvan IV", "Dragon Strike")).toBe(
      `${BASE}/Jarvan_IV_Dragon_Strike.png`
    );
  });

  it("encodes apostrophes in champion names", () => {
    expect(wikiAbilityIconUrl("Kha'Zix", "Taste Their Fear")).toBe(
      `${BASE}/Kha%27Zix_Taste_Their_Fear.png`
    );
  });

  it("uses bare Nunu prefix for Nunu & Willump", () => {
    expect(wikiAbilityIconUrl("Nunu & Willump", "Consume")).toBe(
      `${BASE}/Nunu_Consume.png`
    );
    expect(wikiAbilityIconUrl("Nunu & Willump", "Call of the Freljord")).toBe(
      `${BASE}/Nunu_Call_of_the_Freljord.png`
    );
  });
});

describe("wikiMinimapUrl", () => {
  it("returns the Summoner's Rift minimap for map 11", () => {
    expect(wikiMinimapUrl(11)).toBe(`${BASE}/Summoner%27s_Rift_Minimap.png`);
  });

  it("returns the Howling Abyss minimap for map 12", () => {
    expect(wikiMinimapUrl(12)).toBe(`${BASE}/Howling_Abyss_Minimap.png`);
  });

  it("returns null for unsupported map ids", () => {
    expect(wikiMinimapUrl(21)).toBeNull();
    expect(wikiMinimapUrl(30)).toBeNull();
  });
});

describe("wikiRankedEmblemUrl", () => {
  it("defaults to the 2023 emblem set", () => {
    expect(wikiRankedEmblemUrl("DIAMOND")).toBe(`${BASE}/Season_2023_-_Diamond.png`);
  });

  it("title-cases lowercase tier input", () => {
    expect(wikiRankedEmblemUrl("gold")).toBe(`${BASE}/Season_2023_-_Gold.png`);
  });

  it("honours an explicit year override", () => {
    expect(wikiRankedEmblemUrl("PLATINUM", 2027)).toBe(
      `${BASE}/Season_2027_-_Platinum.png`
    );
  });
});

describe("wikiGoldIconUrl", () => {
  it("returns the wiki gold colored icon SVG", () => {
    expect(wikiGoldIconUrl()).toBe(`${BASE}/Gold_colored_icon.svg`);
  });
});

describe("wikiMinionIconUrl", () => {
  it("returns the wiki minion icon", () => {
    expect(wikiMinionIconUrl()).toBe(`${BASE}/Minion_icon.png`);
  });
});

describe("wikiWardIconUrl", () => {
  it("returns the wiki ward icon", () => {
    expect(wikiWardIconUrl()).toBe(`${BASE}/Ward_icon.png`);
  });
});

describe("wikiPingUrl", () => {
  it("builds the All In ping URL", () => {
    expect(wikiPingUrl("All_In")).toBe(`${BASE}/All_In_ping.png`);
  });

  it("builds the Enemy Missing ping URL", () => {
    expect(wikiPingUrl("Enemy_Missing")).toBe(`${BASE}/Enemy_Missing_ping.png`);
  });
});

describe("wikiStatIconUrl", () => {
  it("builds the Attack damage stat URL", () => {
    expect(wikiStatIconUrl("Attack_damage")).toBe(
      `${BASE}/Attack_damage_colored_icon.svg`
    );
  });

  it("builds the Ability power stat URL", () => {
    expect(wikiStatIconUrl("Ability_power")).toBe(
      `${BASE}/Ability_power_colored_icon.svg`
    );
  });
});

describe("wikiAttackIconUrl", () => {
  it("returns the generic attack SVG", () => {
    expect(wikiAttackIconUrl()).toBe(`${BASE}/Attack.svg`);
  });
});

describe("wikiFileUrl", () => {
  it("places the file under the MediaWiki MD5 bucket dirs", () => {
    const filename = "Magic_damage.png";
    const hash = createHash("md5").update(filename).digest("hex");
    expect(wikiFileUrl(filename)).toBe(
      `${BASE}/${hash[0]}/${hash.slice(0, 2)}/${filename}`
    );
  });

  it("produces distinct buckets for distinct filenames", () => {
    expect(wikiFileUrl("Gold.png")).not.toBe(wikiFileUrl("Magic_damage.png"));
  });
});
