import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { LolImageService } from "./lol-image.service";

interface PrismaStub {
  lolProfileIcon: {
    findMany: ReturnType<typeof vi.fn>;
  };
  lolChampionAbility: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  lolChampion: {
    findMany: ReturnType<typeof vi.fn>;
  };
  lolItem: {
    findMany: ReturnType<typeof vi.fn>;
  };
  lolPerk: {
    findMany: ReturnType<typeof vi.fn>;
  };
  lolSummonerSpell: {
    findMany: ReturnType<typeof vi.fn>;
  };
}

interface MakeServiceOpts {
  profileIcons?: Array<{ id: number; title: string }>;
  ability?: unknown;
  champions?: Array<{ alias: string; name: string }>;
  items?: Array<{ id: number; iconWikiName: string | null }>;
  perks?: Array<{ id: number; iconWikiName: string | null }>;
  spells?: Array<{ id: number; iconWikiName: string | null }>;
}

function makePrisma(opts: MakeServiceOpts = {}): PrismaStub {
  return {
    lolProfileIcon: {
      findMany: vi.fn().mockResolvedValue(opts.profileIcons ?? []),
    },
    lolChampionAbility: {
      findUnique: vi.fn().mockResolvedValue(opts.ability ?? null),
    },
    lolChampion: {
      findMany: vi.fn().mockResolvedValue(opts.champions ?? []),
    },
    lolItem: {
      findMany: vi.fn().mockResolvedValue(opts.items ?? []),
    },
    lolPerk: {
      findMany: vi.fn().mockResolvedValue(opts.perks ?? []),
    },
    lolSummonerSpell: {
      findMany: vi.fn().mockResolvedValue(opts.spells ?? []),
    },
  };
}

// Back-compat shim so the existing positional callers keep working while
// the new tests use the opts shape directly.
function makeService(
  profileIcons: Array<{ id: number; title: string }> = [],
  ability: unknown = null,
  champions: Array<{ alias: string; name: string }> = [],
  extra: {
    items?: MakeServiceOpts["items"];
    perks?: MakeServiceOpts["perks"];
    spells?: MakeServiceOpts["spells"];
  } = {}
): {
  service: LolImageService;
  prisma: PrismaStub;
} {
  const opts: MakeServiceOpts = { profileIcons, ability, champions };
  if (extra.items !== undefined) opts.items = extra.items;
  if (extra.perks !== undefined) opts.perks = extra.perks;
  if (extra.spells !== undefined) opts.spells = extra.spells;
  const prisma = makePrisma(opts);
  const service = new LolImageService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe("LolImageService.champion", () => {
  it("returns wiki-primary + CDragon-fallback for the 'square' variant when the alias has a display name", async () => {
    const { service, prisma } = makeService([], null, [{ alias: "Ahri", name: "Ahri" }]);
    const resolved = await service.champion("Ahri", "square");
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Ahri_OriginalSquare.png",
      "https://cdn.communitydragon.org/latest/champion/ahri/square",
    ]);
    expect(resolved.params).toEqual({ width: 72, quality: 85 });
    expect(prisma.lolChampion.findMany).toHaveBeenCalledTimes(1);
  });

  it("uses the wiki display name (not the Riot alias) for the wiki URL on multi-word champions", async () => {
    const { service } = makeService([], null, [{ alias: "MonkeyKing", name: "Wukong" }]);
    const resolved = await service.champion("MonkeyKing", "square");
    expect(resolved.urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Wukong_OriginalSquare.png"
    );
    expect(resolved.urls[1]).toBe(
      "https://cdn.communitydragon.org/latest/champion/monkeyking/square"
    );
  });

  it("falls back to CDragon alone for 'square' when the alias is missing from the champion table", async () => {
    const { service } = makeService([], null, []);
    const resolved = await service.champion("Ahri", "square");
    expect(resolved.urls).toEqual([
      "https://cdn.communitydragon.org/latest/champion/ahri/square",
    ]);
  });

  it("returns wiki-primary + CDragon-fallback for the 'card' variant at a wider width", async () => {
    const { service } = makeService([], null, [{ alias: "Ahri", name: "Ahri" }]);
    const resolved = await service.champion("Ahri", "card");
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Ahri_OriginalCentered.jpg",
      "https://cdn.communitydragon.org/latest/champion/ahri/splash-art/centered",
    ]);
    expect(resolved.params).toMatchObject({ width: 500, quality: 90 });
    expect(resolved.params.blur).toBeUndefined();
  });

  it("returns wiki-primary + CDragon-fallback for the 'backdrop' variant with blur and 80 quality", async () => {
    const { service } = makeService([], null, [{ alias: "Ahri", name: "Ahri" }]);
    const resolved = await service.champion("Ahri", "backdrop");
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Ahri_OriginalCentered.jpg",
      "https://cdn.communitydragon.org/latest/champion/ahri/splash-art/centered",
    ]);
    expect(resolved.params).toMatchObject({ width: 600, quality: 80, blur: 1 });
  });

  it("falls back to CDragon alone for 'card' when the alias is missing from the champion table", async () => {
    const { service } = makeService([], null, []);
    const resolved = await service.champion("Ahri", "card");
    expect(resolved.urls).toEqual([
      "https://cdn.communitydragon.org/latest/champion/ahri/splash-art/centered",
    ]);
  });

  it("uses the bare 'Nunu' wiki prefix for Nunu & Willump on both square and centered crops", async () => {
    const { service } = makeService([], null, [
      { alias: "Nunu", name: "Nunu & Willump" },
    ]);
    const square = await service.champion("Nunu", "square");
    expect(square.urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Nunu_OriginalSquare.png"
    );
    const card = await service.champion("Nunu", "card");
    expect(card.urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Nunu_OriginalCentered.jpg"
    );
  });

  it("strips the Strawberry_ prefix used for Swarm-mode champion aliases", async () => {
    const { service } = makeService([], null, [{ alias: "Yuumi", name: "Yuumi" }]);
    const resolved = await service.champion("Strawberry_Yuumi", "square");
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Yuumi_OriginalSquare.png",
      "https://cdn.communitydragon.org/latest/champion/yuumi/square",
    ]);
  });
});

describe("LolImageService.item", () => {
  it("returns wiki-primary + DDragon-fallback when iconWikiName is known", async () => {
    const { service } = makeService([], null, [], {
      items: [{ id: 3078, iconWikiName: "Trinity Force" }],
    });
    const resolved = await service.item(3078, "14.10.1");
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Trinity_Force_item.png",
      "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/item/3078.png",
    ]);
    expect(resolved.params).toEqual({ width: 64, quality: 85 });
  });

  it("escapes apostrophes in the wiki slug for items like Luden's Echo", async () => {
    const { service } = makeService([], null, [], {
      items: [{ id: 6655, iconWikiName: "Luden's Echo" }],
    });
    const resolved = await service.item(6655, "14.10.1");
    expect(resolved.urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Luden%27s_Echo_item.png"
    );
  });

  it("falls back to DDragon alone when the itemId is missing from the static sync", async () => {
    const { service } = makeService();
    const resolved = await service.item(3001, "14.10.1");
    expect(resolved.urls).toEqual([
      "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/item/3001.png",
    ]);
  });

  it("memoizes the id→iconWikiName map across calls (single prisma fetch)", async () => {
    const { service, prisma } = makeService([], null, [], {
      items: [{ id: 3078, iconWikiName: "Trinity Force" }],
    });
    await service.item(3078, "14.10.1");
    await service.item(3078, "14.10.2");
    await service.item(3001, "14.10.1");
    expect(prisma.lolItem.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("LolImageService.map", () => {
  it("returns wiki + CDragon fallback for Summoner's Rift (mapId 11)", () => {
    const { service } = makeService();
    const resolved = service.map(11);
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Summoner%27s_Rift_Minimap.png",
      "https://raw.communitydragon.org/latest/game/assets/maps/info/map11/2dlevelminimap_npe_1.png",
    ]);
    expect(resolved.params).toEqual({ width: 256, quality: 85 });
  });

  it("uses the bare '2dlevelminimap.png' filename for Howling Abyss (mapId 12)", () => {
    const { service } = makeService();
    const resolved = service.map(12);
    expect(resolved.urls[1]).toBe(
      "https://raw.communitydragon.org/latest/game/assets/maps/info/map12/2dlevelminimap.png"
    );
  });

  it("throws for an unknown mapId so the controller can 400/404", () => {
    const { service } = makeService();
    expect(() => service.map(999)).toThrow(/unknown mapId/);
  });
});

describe("LolImageService.rankEmblem", () => {
  it("builds wiki primary + CDragon `emblem-{tier}` fallback", () => {
    const { service } = makeService();
    const resolved = service.rankEmblem("GOLD", 2023);
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Season_2023_-_Gold.png",
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-gold.png",
    ]);
    expect(resolved.params).toEqual({ width: 128, quality: 85 });
  });

  it("lowercases the tier for the CDragon path (emerald included)", () => {
    const { service } = makeService();
    expect(service.rankEmblem("EMERALD", 2023).urls[1]).toBe(
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-emerald.png"
    );
  });
});

describe("LolImageService.uiIcon", () => {
  it("returns wiki + CDragon `goldicon.png` fallback for 'gold'", () => {
    const { service } = makeService();
    expect(service.uiIcon("gold").urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Gold_colored_icon.svg",
      "https://raw.communitydragon.org/latest/game/assets/ux/floatingtext/goldicon.png",
    ]);
  });

  it("returns wiki + CDragon `icon_minions.png` for 'minion' with extractTopHalf to crop the 1:2 sprite", () => {
    const { service } = makeService();
    const resolved = service.uiIcon("minion");
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Minion_icon.png",
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/icon_minions.png",
    ]);
    expect(resolved.params).toMatchObject({ extractTopHalf: true });
  });

  it("stays single-upstream for 'ward' — no historical CDragon source existed", () => {
    const { service } = makeService();
    expect(service.uiIcon("ward").urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Ward_icon.png",
    ]);
  });

  it("returns wiki + CDragon `kills.png` fallback for 'attack'", () => {
    const { service } = makeService();
    expect(service.uiIcon("attack").urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Attack.svg",
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/kills.png",
    ]);
  });
});

describe("LolImageService.ability", () => {
  it("returns wiki-first + CDragon fallback for a normal slot", async () => {
    const { service, prisma } = makeService([], {
      championId: 103,
      slot: "Q",
      abilityIndex: 1,
      name: "Orb of Deception",
      iconWikiName: null,
      champion: { name: "Ahri", alias: "Ahri" },
    });
    const resolved = await service.ability(103, "Q", 1);
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Ahri_Orb_of_Deception.png",
      "https://cdn.communitydragon.org/latest/champion/ahri/ability-icon/q",
    ]);
    expect(resolved.params).toEqual({ width: 40, quality: 85 });
    expect(prisma.lolChampionAbility.findUnique).toHaveBeenCalledWith({
      where: {
        championId_slot_abilityIndex: { championId: 103, slot: "Q", abilityIndex: 1 },
      },
      include: { champion: { select: { name: true, alias: true } } },
    });
  });

  it("lowercases Passive slot and compound alias for CDragon URL", async () => {
    const { service } = makeService([], {
      championId: 59,
      slot: "Passive",
      abilityIndex: 0,
      name: "Martial Cadence",
      iconWikiName: null,
      champion: { name: "Jarvan IV", alias: "JarvanIV" },
    });
    const resolved = await service.ability(59, "Passive", 0);
    expect(resolved.urls[1]).toBe(
      "https://cdn.communitydragon.org/latest/champion/jarvaniv/ability-icon/passive"
    );
  });

  it("throws when the ability row does not exist", async () => {
    const { service } = makeService([], null);
    await expect(service.ability(999, "Q", 0)).rejects.toThrow(/unknown ability/);
  });
});

describe("LolImageService.profileIcon", () => {
  it("returns wiki-first with DDragon fallback when an iconId has a wiki title", async () => {
    const { service, prisma } = makeService([
      { id: 588, title: "Doom Bots Singed" },
      { id: 1132, title: "00 Reactivated" },
    ]);
    const resolved = await service.profileIcon(588, "14.10.1");
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Doom_Bots_Singed_profileicon.png",
      "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/588.png",
    ]);
    expect(resolved.params).toEqual({ width: 72, quality: 85 });
    expect(prisma.lolProfileIcon.findMany).toHaveBeenCalledTimes(1);
  });

  it("falls back to DDragon alone when the iconId is missing from the wiki sync", async () => {
    const { service } = makeService([{ id: 1132, title: "00 Reactivated" }]);
    const resolved = await service.profileIcon(99999, "14.10.1");
    expect(resolved.urls).toEqual([
      "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/99999.png",
    ]);
  });

  it("memoizes the id→title map across calls (single prisma fetch)", async () => {
    const { service, prisma } = makeService([{ id: 588, title: "Doom Bots Singed" }]);
    await service.profileIcon(588, "14.10.1");
    await service.profileIcon(99999, "14.10.1");
    await service.profileIcon(588, "14.10.2");
    expect(prisma.lolProfileIcon.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("LolImageService.role", () => {
  it("returns wiki PNG + CDragon SVG fallback for the canonical slugs", () => {
    const { service } = makeService();
    expect(service.role("middle").urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Middle_icon.png",
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-middle.svg",
    ]);
  });

  it("maps the Match-V5 'utility' slug to wiki's 'Support_icon.png'", () => {
    const { service } = makeService();
    expect(service.role("utility").urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Support_icon.png"
    );
  });

  it("transcodes to a 64px WebP", () => {
    const { service } = makeService();
    expect(service.role("top").params).toEqual({ width: 64, quality: 85 });
  });
});

describe("LolImageService.champClass", () => {
  it("returns wiki PNG + legacy CDragon `npe-ft-role-icon-{slug}.png` fallback", () => {
    const { service } = makeService();
    expect(service.champClass("mage").urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Mage_icon.png",
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/npe-ft-role-icon-mage.png",
    ]);
  });

  it("maps the DDragon 'assassin' slug to wiki's 'Slayer_icon.png' while keeping the CDragon legacy name", () => {
    const { service } = makeService();
    const resolved = service.champClass("assassin");
    expect(resolved.urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Slayer_icon.png"
    );
    expect(resolved.urls[1]).toBe(
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/npe-ft-role-icon-assassin.png"
    );
  });

  it("maps the DDragon 'support' slug to wiki's 'Controller_icon.png'", () => {
    const { service } = makeService();
    expect(service.champClass("support").urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Controller_icon.png"
    );
  });
});

describe("LolImageService.rune", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = url.toString();
        if (u.endsWith("/v1/perks.json")) {
          return new Response(
            JSON.stringify([
              {
                id: 8005,
                iconPath:
                  "/lol-game-data/assets/perks/styles/precision/presstheattack/presstheattack.png",
              },
              {
                id: 8112,
                iconPath:
                  "/lol-game-data/assets/perks/styles/domination/electrocute/electrocute.png",
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        throw new Error(`unexpected fetch ${u}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns wiki-primary + CDragon-fallback when iconWikiName is known for the keystone", async () => {
    const { service } = makeService([], null, [], {
      perks: [{ id: 8005, iconWikiName: "Press the Attack" }],
    });
    const resolved = await service.rune(8005);
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Press_the_Attack_rune.png",
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/perks/styles/precision/presstheattack/presstheattack.png",
    ]);
    expect(resolved.params).toEqual({ width: 40, quality: 85 });
  });

  it("falls back to CDragon alone when iconWikiName is missing from the static sync", async () => {
    const { service } = makeService();
    const resolved = await service.rune(8005);
    expect(resolved.urls).toEqual([
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/perks/styles/precision/presstheattack/presstheattack.png",
    ]);
  });

  it("throws for an unknown perk id rather than constructing a 404-bound URL", async () => {
    const { service } = makeService();
    await expect(service.rune(99_999)).rejects.toThrow(/unknown perk id 99999/);
  });
});

describe("LolImageService.spell", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = url.toString();
        if (u.endsWith("/v1/summoner-spells.json")) {
          return new Response(
            JSON.stringify([
              {
                id: 4,
                iconPath: "/lol-game-data/assets/data/spells/icons2d/summoner_flash.png",
              },
              {
                id: 14,
                iconPath: "/lol-game-data/assets/data/spells/icons2d/summoner_dot.png",
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        throw new Error(`unexpected fetch ${u}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns wiki-primary + CDragon-fallback when iconWikiName is known for the spell", async () => {
    const { service } = makeService([], null, [], {
      spells: [{ id: 4, iconWikiName: "Flash" }],
    });
    const resolved = await service.spell(4);
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Flash.png",
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_flash.png",
    ]);
    expect(resolved.params).toEqual({ width: 40, quality: 85 });
  });

  it("slugs multi-word and exclamation-mark spell names like 'To the King!'", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = url.toString();
        if (u.endsWith("/v1/summoner-spells.json")) {
          return new Response(
            JSON.stringify([
              {
                id: 30,
                iconPath:
                  "/lol-game-data/assets/data/spells/icons2d/summoner_porothrow.png",
              },
            ]),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        throw new Error(`unexpected fetch ${u}`);
      })
    );
    const { service } = makeService([], null, [], {
      spells: [{ id: 30, iconWikiName: "To the King!" }],
    });
    const resolved = await service.spell(30);
    expect(resolved.urls[0]).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/To_the_King!.png"
    );
  });

  it("falls back to CDragon alone when iconWikiName is missing from the static sync", async () => {
    const { service } = makeService();
    const resolved = await service.spell(4);
    expect(resolved.urls).toEqual([
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_flash.png",
    ]);
  });

  it("memoizes the id→iconWikiName map across calls (single prisma fetch)", async () => {
    const { service, prisma } = makeService([], null, [], {
      spells: [{ id: 4, iconWikiName: "Flash" }],
    });
    await service.spell(4);
    await service.spell(4);
    expect(prisma.lolSummonerSpell.findMany).toHaveBeenCalledTimes(1);
  });

  it("throws for an unknown summoner spell id", async () => {
    const { service } = makeService();
    await expect(service.spell(99_999)).rejects.toThrow(
      /unknown summoner spell id 99999/
    );
  });
});
