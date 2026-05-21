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
}

function makePrisma(
  rows: Array<{ id: number; title: string }> = [],
  ability: unknown = null
): PrismaStub {
  return {
    lolProfileIcon: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
    lolChampionAbility: {
      findUnique: vi.fn().mockResolvedValue(ability),
    },
  };
}

function makeService(
  rows: Array<{ id: number; title: string }> = [],
  ability: unknown = null
): {
  service: LolImageService;
  prisma: PrismaStub;
} {
  const prisma = makePrisma(rows, ability);
  const service = new LolImageService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe("LolImageService.champion", () => {
  const { service } = makeService();

  it("builds the CDragon square URL with a lower-cased alias", () => {
    const resolved = service.champion("Ahri", "square");
    expect(resolved.urls).toEqual([
      "https://cdn.communitydragon.org/latest/champion/ahri/square",
    ]);
    expect(resolved.params).toEqual({ width: 72, quality: 85 });
  });

  it("uses splash-art for the 'card' variant at a wider width", () => {
    const resolved = service.champion("Ahri", "card");
    expect(resolved.urls[0]).toContain("/splash-art/centered");
    expect(resolved.params).toMatchObject({ width: 500, quality: 90 });
    expect(resolved.params.blur).toBeUndefined();
  });

  it("applies a blur and 80 quality for the 'backdrop' variant", () => {
    const resolved = service.champion("Ahri", "backdrop");
    expect(resolved.urls[0]).toContain("/splash-art/centered");
    expect(resolved.params).toMatchObject({ width: 600, quality: 80, blur: 1 });
  });

  it("strips the Strawberry_ prefix used for Swarm-mode champion aliases", () => {
    const resolved = service.champion("Strawberry_Yuumi", "square");
    expect(resolved.urls[0]).toBe(
      "https://cdn.communitydragon.org/latest/champion/yuumi/square"
    );
  });
});

describe("LolImageService.item", () => {
  const { service } = makeService();

  it("builds the DDragon item URL pinned to the requested patch", () => {
    const resolved = service.item(3001, "14.10.1");
    expect(resolved.urls).toEqual([
      "https://ddragon.leagueoflegends.com/cdn/14.10.1/img/item/3001.png",
    ]);
    expect(resolved.params).toEqual({ width: 64, quality: 85 });
  });
});

describe("LolImageService.ability", () => {
  it("builds the wiki ability URL from the DB row's champion + ability names", async () => {
    const { service, prisma } = makeService([], {
      championId: 103,
      slot: "Q",
      abilityIndex: 1,
      name: "Orb of Deception",
      iconWikiName: null,
      champion: { name: "Ahri" },
    });
    const resolved = await service.ability(103, "Q", 1);
    expect(resolved.urls).toEqual([
      "https://wiki.leagueoflegends.com/en-us/images/Ahri_Orb_of_Deception.png",
    ]);
    expect(resolved.params).toEqual({ width: 40, quality: 85 });
    expect(prisma.lolChampionAbility.findUnique).toHaveBeenCalledWith({
      where: {
        championId_slot_abilityIndex: { championId: 103, slot: "Q", abilityIndex: 1 },
      },
      include: { champion: { select: { name: true } } },
    });
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

describe("LolImageService.roleIconUrl", () => {
  const { service } = makeService();

  it("returns the static role-icon URL by slug", () => {
    expect(service.roleIconUrl("middle")).toBe(
      "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/svg/position-middle.svg"
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

  it("resolves to the lower-cased CDragon game-data icon URL for a known keystone", async () => {
    const { service } = makeService();
    const resolved = await service.rune(8005);
    expect(resolved.urls).toEqual([
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/perks/styles/precision/presstheattack/presstheattack.png",
    ]);
    expect(resolved.params).toEqual({ width: 40, quality: 85 });
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

  it("resolves to the CDragon icon URL for a known summoner spell id", async () => {
    const { service } = makeService();
    const resolved = await service.spell(4);
    expect(resolved.urls[0]).toBe(
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_flash.png"
    );
  });

  it("throws for an unknown summoner spell id", async () => {
    const { service } = makeService();
    await expect(service.spell(99_999)).rejects.toThrow(
      /unknown summoner spell id 99999/
    );
  });
});
