import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { parseChampionAbilityModule, parseItemDataModule } from "./lol-static-parsers";
import { LolStaticSyncService } from "./lol-static-sync.service";

// --- Lua parsers ---------------------------------------------------------

describe("parseItemDataModule", () => {
  it("parses a single item with stats, recipe, type, buy, and passive description", () => {
    const lua = `
return {
  ["Trinity Force"] = {
    ["id"]                  = 3078,
    ["tier"]                = 3,
    ["type"]                = {"Legendary"},
    ["modes"] = {
      ["classic sr 5v5"]  = true,
    },
    ["menu"] = {
      ["fighter"] = true,
      ["marksman"] = true,
    },
    ["stats"] = {
      ["ad"] = 36,
      ["hp"] = 333,
    },
    ["effects"] = {
      ["pass"] = {
        ["name"]        = "Spellblade",
        ["description"] = "After using an [[Champion ability|ability]], deals {{as|200% '''base''' AD}} on-hit.",
      },
    },
    ["recipe"]              = {"Sheen", "Phage", "Hearthbound Axe"},
    ["buy"]                 = 3333,
  },
}
`.trim();
    const items = parseItemDataModule(lua);
    expect(items).toHaveLength(1);
    const item = items[0];
    if (!item) throw new Error("expected one item");
    expect(item).toMatchObject({
      id: 3078,
      name: "Trinity Force",
      tier: 3,
      itemType: ["Legendary"],
      priceTotal: 3333,
      recipe: ["Sheen", "Phage", "Hearthbound Axe"],
      categories: ["fighter", "marksman"],
      stats: { ad: 36, hp: 333 },
    });
    expect(item.descriptionWikitext).toContain("{{as|200% '''base''' AD}}");
  });

  it("skips entries without an id (malformed or removed)", () => {
    const lua = `
return {
  ["Legit"] = {
    ["id"] = 1001,
    ["tier"] = 1,
  },
  ["Stub"] = {
    ["tier"] = 1,
  },
}
`.trim();
    const items = parseItemDataModule(lua);
    expect(items.map((i) => i.id)).toEqual([1001]);
  });

  it("handles wiki-template braces inside descriptions without losing track of nesting", () => {
    const lua = `
return {
  ["Tricky"] = {
    ["id"] = 9999,
    ["effects"] = {
      ["pass"] = {
        ["description"] = "Gain {{as|10 ability haste}} when you use {{as|{{ai|Recall|self}}}}.",
      },
    },
    ["buy"] = 1234,
  },
}
`.trim();
    const items = parseItemDataModule(lua);
    expect(items).toHaveLength(1);
    const item = items[0];
    if (!item) throw new Error("expected one item");
    expect(item.priceTotal).toBe(1234);
    expect(item.descriptionWikitext).toContain("{{as|{{ai|Recall|self}}}}");
  });
});

describe("parseChampionAbilityModule", () => {
  it("collects every named ability variant per slot in source order", () => {
    const lua = `
return {
  ["Karma"] = {
    ["skill_i"] = { [1] = "Gathering Fire" },
    ["skill_q"] = { [1] = "Inner Flame", [2] = "Soulflare" },
    ["skill_w"] = { [1] = "Focused Resolve", [2] = "Renewal" },
    ["skill_e"] = { [1] = "Inspire", [2] = "Defiance" },
    ["skill_r"] = { [1] = "Mantra" },
  },
}
`.trim();
    const result = parseChampionAbilityModule(lua);
    expect(result).toHaveLength(1);
    const karma = result[0];
    if (!karma) throw new Error("expected karma");
    expect(karma.championWikiName).toBe("Karma");
    expect(karma.abilities).toEqual([
      { slot: "Passive", name: "Gathering Fire" },
      { slot: "Q", name: "Inner Flame" },
      { slot: "Q", name: "Soulflare" },
      { slot: "W", name: "Focused Resolve" },
      { slot: "W", name: "Renewal" },
      { slot: "E", name: "Inspire" },
      { slot: "E", name: "Defiance" },
      { slot: "R", name: "Mantra" },
    ]);
  });
});

// --- Service ------------------------------------------------------------

interface PrismaStubs {
  lolItem: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  lolChampion: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  lolChampionAbility: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  lolSummonerSpell: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  lolPerk: {
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

function makePrisma(): PrismaStubs {
  return {
    lolItem: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    lolChampion: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    lolChampionAbility: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    lolSummonerSpell: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    lolPerk: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
}

function makeService(prisma: PrismaStubs): LolStaticSyncService {
  return new LolStaticSyncService(prisma as unknown as PrismaService);
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function wikiModuleResponse(content: string): Response {
  return jsonResponse({
    query: {
      pages: {
        "123": { revisions: [{ slots: { main: { "*": content } } }] },
      },
    },
  });
}

describe("LolStaticSyncService", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("syncs items end-to-end from the bulk wiki module", async () => {
    const prisma = makePrisma();
    const lua = `
return {
  ["Trinity Force"] = {
    ["id"] = 3078,
    ["tier"] = 3,
    ["type"] = {"Legendary"},
    ["buy"] = 3333,
    ["recipe"] = {"Sheen", "Phage"},
  },
}
`.trim();
    fetchSpy.mockResolvedValueOnce(wikiModuleResponse(lua));

    const written = await makeService(prisma).syncItems("26.10");
    expect(written).toBe(1);
    expect(prisma.lolItem.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.lolItem.upsert.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call.where).toEqual({ id: 3078 });
    expect(call.create).toMatchObject({
      id: 3078,
      name: "Trinity Force",
      priceTotal: 3333,
      iconWikiName: "Trinity Force",
      wikiSyncedPatchVersion: "26.10",
    });
  });

  it("one item upsert failure does not abort the rest", async () => {
    const prisma = makePrisma();
    prisma.lolItem.upsert
      .mockRejectedValueOnce(new Error("constraint violation"))
      .mockResolvedValueOnce({});
    const lua = `
return {
  ["Bad"] = { ["id"] = 1, ["tier"] = 1 },
  ["Good"] = { ["id"] = 2, ["tier"] = 1 },
}
`.trim();
    fetchSpy.mockResolvedValueOnce(wikiModuleResponse(lua));

    const written = await makeService(prisma).syncItems("26.10");
    expect(written).toBe(1);
    expect(prisma.lolItem.upsert).toHaveBeenCalledTimes(2);
  });

  it("syncs summoner spells from DDragon and resets missingSyncCycles on every seen row", async () => {
    const prisma = makePrisma();
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: {
          SummonerFlash: { key: "4", name: "Flash", modes: ["CLASSIC"] },
          SummonerHeal: { key: "7", name: "Heal", modes: ["CLASSIC"] },
        },
      })
    );

    const written = await makeService(prisma).syncSummonerSpells("16.10.1");
    expect(written).toBe(2);
    expect(prisma.lolSummonerSpell.upsert).toHaveBeenCalledTimes(2);
    const ids = prisma.lolSummonerSpell.upsert.mock.calls.map(([c]) => c.where.id);
    expect(ids.sort()).toEqual([4, 7]);
    for (const call of prisma.lolSummonerSpell.upsert.mock.calls) {
      expect(call[0].update.missingSyncCycles).toBe(0);
      expect(call[0].update.retiredAt).toBeNull();
    }
  });

  it("retires a perk after four consecutive missing sync cycles", async () => {
    const prisma = makePrisma();
    // DDragon now reports only one perk (id 8005). The DB still has perkId
    // 8200 from before its retirement — three cycles already missed.
    fetchSpy.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 8000,
          key: "Precision",
          name: "Precision",
          slots: [
            {
              runes: [{ id: 8005, key: "PressTheAttack", name: "Press the Attack" }],
            },
          ],
        },
      ])
    );
    prisma.lolPerk.findMany.mockResolvedValueOnce([{ id: 8200, missingSyncCycles: 3 }]);

    await makeService(prisma).syncPerks("16.10.1");

    expect(prisma.lolPerk.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.lolPerk.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.lolPerk.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.where.id.notIn).toEqual([8005]);

    expect(prisma.lolPerk.update).toHaveBeenCalledTimes(1);
    const updateCall = prisma.lolPerk.update.mock.calls[0]?.[0];
    expect(updateCall.where).toEqual({ id: 8200 });
    expect(updateCall.data.missingSyncCycles).toBe(4);
    expect(updateCall.data.retiredAt).toBeInstanceOf(Date);
  });

  it("bumps but does not retire a perk that has only missed one cycle", async () => {
    const prisma = makePrisma();
    fetchSpy.mockResolvedValueOnce(jsonResponse([]));
    prisma.lolPerk.findMany.mockResolvedValueOnce([{ id: 8210, missingSyncCycles: 0 }]);

    await makeService(prisma).syncPerks("16.10.1");

    const updateCall = prisma.lolPerk.update.mock.calls[0]?.[0];
    expect(updateCall.data.missingSyncCycles).toBe(1);
    expect(updateCall.data.retiredAt).toBeNull();
  });

  it("derives keystone vs minor-slot labels from runesReforged shape", async () => {
    const prisma = makePrisma();
    fetchSpy.mockResolvedValueOnce(
      jsonResponse([
        {
          id: 8000,
          key: "Precision",
          name: "Precision",
          slots: [
            { runes: [{ id: 8005, key: "Pta", name: "Press the Attack" }] },
            { runes: [{ id: 9101, key: "Overheal", name: "Overheal" }] },
          ],
        },
      ])
    );

    await makeService(prisma).syncPerks("16.10.1");

    const calls = prisma.lolPerk.upsert.mock.calls.map(([c]) => ({
      id: c.where.id,
      slot: c.create.slot,
      path: c.create.path,
    }));
    expect(calls).toEqual([
      { id: 8005, slot: "Keystone", path: "Precision" },
      { id: 9101, slot: "Slot1", path: "Precision" },
    ]);
  });

  it("joins champion DDragon rows with wiki ability rows by display name", async () => {
    const prisma = makePrisma();
    fetchSpy
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            MonkeyKing: { key: "62", name: "Wukong", tags: ["Fighter"] },
            Aatrox: { key: "266", name: "Aatrox", tags: ["Fighter"] },
          },
        })
      )
      .mockResolvedValueOnce(
        wikiModuleResponse(
          `
return {
  ["Wukong"] = {
    ["skill_q"] = { [1] = "Crushing Blow" },
  },
  ["Aatrox"] = {
    ["skill_q"] = { [1] = "The Darkin Blade" },
  },
}
`.trim()
        )
      );

    const written = await makeService(prisma).syncChampionsAndAbilities(
      "16.10.1",
      "26.10"
    );
    expect(written).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    // The first $transaction is for the first champion enumerated by
    // Object.entries — the order isn't guaranteed across engines, so just
    // verify both aliases were upserted with the correct id.
    const upsertCalls = prisma.lolChampion.upsert.mock.calls.map(([c]) => ({
      alias: c.create.alias,
      id: c.create.id,
      name: c.create.name,
    }));
    expect(upsertCalls).toContainEqual({
      alias: "MonkeyKing",
      id: 62,
      name: "Wukong",
    });
    expect(upsertCalls).toContainEqual({
      alias: "Aatrox",
      id: 266,
      name: "Aatrox",
    });
  });

  it("getBundle() shapes prisma rows into the LolStaticBundle DTO with grouped abilities and max syncedAt", async () => {
    const prisma = makePrisma();
    const wikiEarly = new Date("2026-05-20T00:00:00.000Z");
    const wikiLate = new Date("2026-05-21T12:00:00.000Z");
    const ddragonLate = new Date("2026-05-21T11:30:00.000Z");
    prisma.lolChampion.findMany.mockResolvedValueOnce([
      {
        id: 62,
        alias: "MonkeyKing",
        name: "Wukong",
        roles: ["Fighter"],
        ddragonSyncedAt: ddragonLate,
        wikiSyncedAt: wikiEarly,
        wikiSyncedPatchVersion: "26.10",
      },
    ]);
    prisma.lolChampionAbility.findMany.mockResolvedValueOnce([
      {
        championId: 62,
        slot: "Q",
        abilityIndex: 0,
        name: "Crushing Blow",
        iconWikiName: null,
        descriptionWikitext: null,
        descriptionHtml: null,
      },
      {
        championId: 62,
        slot: "Passive",
        abilityIndex: 0,
        name: "Stone Skin",
        iconWikiName: null,
        descriptionWikitext: null,
        descriptionHtml: null,
      },
    ]);
    prisma.lolItem.findMany.mockResolvedValueOnce([
      {
        id: 3078,
        name: "Trinity Force",
        tier: 3,
        itemType: ["Legendary"],
        priceTotal: 3333,
        recipe: ["Sheen"],
        categories: ["fighter"],
        stats: { ad: 36 },
        descriptionWikitext: "raw",
        descriptionHtml: null,
        iconWikiName: "Trinity Force",
        wikiSyncedAt: wikiLate,
        wikiSyncedPatchVersion: "26.10",
      },
    ]);
    prisma.lolSummonerSpell.findMany.mockResolvedValueOnce([
      {
        id: 4,
        name: "Flash",
        iconWikiName: "Flash",
        descriptionWikitext: null,
        descriptionHtml: null,
        ddragonSyncedAt: ddragonLate,
        wikiSyncedAt: null,
        retiredAt: null,
      },
    ]);
    prisma.lolPerk.findMany.mockResolvedValueOnce([
      {
        id: 8005,
        name: "Press the Attack",
        path: "Precision",
        slot: "Keystone",
        iconWikiName: "Press the Attack",
        descriptionWikitext: null,
        descriptionHtml: null,
        ddragonSyncedAt: ddragonLate,
        wikiSyncedAt: null,
        retiredAt: null,
      },
      {
        id: 8230,
        name: "Phase Rush",
        path: "Sorcery",
        slot: "Keystone",
        iconWikiName: "Phase Rush",
        descriptionWikitext: null,
        descriptionHtml: null,
        ddragonSyncedAt: ddragonLate,
        wikiSyncedAt: null,
        retiredAt: new Date("2026-05-19T00:00:00.000Z"),
      },
    ]);

    const bundle = await makeService(prisma).getBundle();

    expect(bundle.patchVersion).toBe("26.10");
    expect(bundle.syncedAt).toBe(wikiLate.toISOString());
    expect(bundle.champions).toEqual([
      { id: 62, alias: "MonkeyKing", name: "Wukong", roles: ["Fighter"] },
    ]);
    // Abilities indexed by championId, in the order returned by prisma
    // (caller sorts by slot then abilityIndex via orderBy clause).
    expect(bundle.championAbilities[62]).toEqual([
      {
        slot: "Q",
        abilityIndex: 0,
        name: "Crushing Blow",
        iconWikiName: null,
        descriptionWikitext: null,
        descriptionHtml: null,
      },
      {
        slot: "Passive",
        abilityIndex: 0,
        name: "Stone Skin",
        iconWikiName: null,
        descriptionWikitext: null,
        descriptionHtml: null,
      },
    ]);
    expect(bundle.items).toHaveLength(1);
    expect(bundle.items[0]?.stats).toEqual({ ad: 36 });
    expect(bundle.summonerSpells).toHaveLength(1);
    expect(bundle.perks).toHaveLength(2);
    // Retired perk is kept (historical matches reference it) but flagged.
    const phaseRush = bundle.perks.find((p) => p.id === 8230);
    expect(phaseRush?.retiredAt).toBe("2026-05-19T00:00:00.000Z");
  });

  it("getBundle() returns null patchVersion + null syncedAt on a cold-start empty catalog", async () => {
    const prisma = makePrisma();
    const bundle = await makeService(prisma).getBundle();
    expect(bundle.patchVersion).toBeNull();
    expect(bundle.syncedAt).toBeNull();
    expect(bundle.champions).toEqual([]);
    expect(bundle.championAbilities).toEqual({});
    expect(bundle.items).toEqual([]);
    expect(bundle.summonerSpells).toEqual([]);
    expect(bundle.perks).toEqual([]);
  });
});
