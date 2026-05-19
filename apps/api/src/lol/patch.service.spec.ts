import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { PatchService, truncateVersion, wikiPageTitle } from "./patch.service";

interface PatchPrismaStubs {
  patchVersion: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  patchChange: {
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

function makePrisma(): PatchPrismaStubs {
  return {
    patchVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    patchChange: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
}

function makeService(prisma: PatchPrismaStubs): PatchService {
  return new PatchService(prisma as unknown as PrismaService);
}

describe("truncateVersion", () => {
  it("translates legacy season major to year-based (+10)", () => {
    expect(truncateVersion("16.10.1")).toBe("26.10");
    expect(truncateVersion("14.20.1")).toBe("24.20");
  });

  it("passes through when major already looks year-shaped (>= 20)", () => {
    expect(truncateVersion("26.10.1")).toBe("26.10");
  });

  it("returns input untouched when malformed", () => {
    expect(truncateVersion("notaversion")).toBe("notaversion");
    expect(truncateVersion("16")).toBe("16");
  });
});

describe("wikiPageTitle", () => {
  it("zero-pads single-digit minor to match wiki page naming", () => {
    expect(wikiPageTitle("26.9")).toBe("V26.09");
    expect(wikiPageTitle("26.1")).toBe("V26.01");
  });

  it("leaves two-digit minor untouched", () => {
    expect(wikiPageTitle("26.10")).toBe("V26.10");
  });
});

describe("PatchService.getCurrentChanges", () => {
  it("returns null version + no changes when no patches are synced yet", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findFirst.mockResolvedValue(null);

    const result = await makeService(prisma).getCurrentChanges(["Ahri"]);

    expect(result).toEqual({ patchVersion: null, changes: [] });
    expect(prisma.patchChange.findMany).not.toHaveBeenCalled();
  });

  it("returns the patch version with empty changes when no champion filter is given", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findFirst.mockResolvedValue({ version: "26.10" });

    const result = await makeService(prisma).getCurrentChanges([]);

    // Skip the DB hit entirely — PN2 always passes a filter, and an empty
    // filter is a "tell me the patch label" probe, not a request for the
    // entire patch's changes.
    expect(result).toEqual({ patchVersion: "26.10", changes: [] });
    expect(prisma.patchChange.findMany).not.toHaveBeenCalled();
  });

  it("groups rows by champion and preserves DB order within each group", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findFirst.mockResolvedValue({ version: "26.10" });
    prisma.patchChange.findMany.mockResolvedValue([
      {
        subject: "Ahri",
        ability: "Q",
        changeText: "Damage increased to 50 from 40.",
        changeType: "buff",
      },
      {
        subject: "Ahri",
        ability: "Q",
        changeText: "Cooldown reduced to 7 from 8.",
        changeType: "buff",
      },
      {
        subject: "Lee Sin",
        ability: "W",
        changeText: "Shield reduced to 60 from 70.",
        changeType: "nerf",
      },
    ]);

    const result = await makeService(prisma).getCurrentChanges(["Ahri", "Lee Sin"]);

    expect(result.patchVersion).toBe("26.10");
    expect(result.changes).toEqual([
      {
        champion: "Ahri",
        changes: [
          {
            ability: "Q",
            changeText: "Damage increased to 50 from 40.",
            changeType: "buff",
          },
          {
            ability: "Q",
            changeText: "Cooldown reduced to 7 from 8.",
            changeType: "buff",
          },
        ],
      },
      {
        champion: "Lee Sin",
        changes: [
          {
            ability: "W",
            changeText: "Shield reduced to 60 from 70.",
            changeType: "nerf",
          },
        ],
      },
    ]);
    expect(prisma.patchChange.findMany).toHaveBeenCalledWith({
      where: {
        patchVersion: "26.10",
        section: "champion",
        subject: { in: ["Ahri", "Lee Sin"] },
      },
      orderBy: [{ subject: "asc" }, { id: "asc" }],
    });
  });
});

describe("PatchService.listPatches", () => {
  it("returns an empty list when nothing has been synced", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findMany.mockResolvedValue([]);

    const result = await makeService(prisma).listPatches();

    expect(result).toEqual([]);
    expect(prisma.patchVersion.findMany).toHaveBeenCalledWith({
      orderBy: [{ patchDate: { sort: "desc", nulls: "last" } }, { version: "desc" }],
      take: 10,
    });
  });

  it("serializes DateTime fields to ISO strings and preserves DB order", async () => {
    const prisma = makePrisma();
    const fetched = new Date("2026-05-17T01:00:00.000Z");
    const patchDate = new Date("2026-05-15T00:00:00.000Z");
    prisma.patchVersion.findMany.mockResolvedValue([
      { version: "26.10", patchDate, fetchedAt: fetched },
      {
        version: "26.9",
        patchDate: null,
        fetchedAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);

    const result = await makeService(prisma).listPatches();

    expect(result).toEqual([
      {
        version: "26.10",
        patchDate: "2026-05-15T00:00:00.000Z",
        fetchedAt: "2026-05-17T01:00:00.000Z",
      },
      {
        version: "26.9",
        patchDate: null,
        fetchedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);
  });

  it("honors a custom limit", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findMany.mockResolvedValue([]);

    await makeService(prisma).listPatches(3);

    expect(prisma.patchVersion.findMany).toHaveBeenCalledWith({
      orderBy: [{ patchDate: { sort: "desc", nulls: "last" } }, { version: "desc" }],
      take: 3,
    });
  });
});

describe("PatchService.fetchVersionList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the version list from ddragon", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(["16.10.1", "16.9.1"]), { status: 200 })
        )
    );
    const result = await makeService(makePrisma()).fetchVersionList();
    expect(result).toEqual(["16.10.1", "16.9.1"]);
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500 }))
    );
    await expect(makeService(makePrisma()).fetchVersionList()).rejects.toThrow(
      /ddragon versions HTTP 500/
    );
  });

  it("throws when ddragon returns an empty list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    );
    await expect(makeService(makePrisma()).fetchVersionList()).rejects.toThrow(
      /response was empty/
    );
  });
});

describe("PatchService.syncIfNewPatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the latest patch is already recorded", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(["16.10.1"]), { status: 200 }))
    );
    const prisma = makePrisma();
    prisma.patchVersion.findUnique.mockResolvedValue({ version: "26.10" });
    const result = await makeService(prisma).syncIfNewPatch();
    expect(result).toBeNull();
    expect(prisma.patchVersion.findUnique).toHaveBeenCalledWith({
      where: { version: "26.10" },
    });
  });

  it("syncs the latest version when not already recorded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: unknown) => {
        const url = String(input);
        if (url.includes("api/versions.json")) {
          return new Response(JSON.stringify(["16.10.1"]), { status: 200 });
        }
        if (url.includes("wiki.leagueoflegends.com/api.php") && url.includes("page=")) {
          return new Response(
            JSON.stringify({
              parse: {
                title: "V26.10",
                wikitext: {
                  "*": "== Champions ==\n;{{ci|Ahri}}\n* {{ai|Orb of Deception|Ahri}}\n** Damage increased.\n",
                },
              },
            }),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );
    const prisma = makePrisma();
    prisma.patchVersion.findUnique.mockResolvedValue(null);
    const result = await makeService(prisma).syncIfNewPatch();
    expect(result).toBe("26.10");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe("PatchService.syncVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockWikitext(text: string): ReturnType<typeof vi.fn> {
    return vi.fn().mockImplementation(async (input: unknown) => {
      const url = String(input);
      if (url.includes("wiki.leagueoflegends.com/api.php") && url.includes("page=")) {
        return new Response(
          JSON.stringify({ parse: { title: "V26.10", wikitext: { "*": text } } }),
          { status: 200 }
        );
      }
      // ddragon champion list
      if (url.includes("ddragon.leagueoflegends.com/cdn/")) {
        return new Response(JSON.stringify({ data: { Ahri: { name: "Ahri" } } }), {
          status: 200,
        });
      }
      // wiki module
      if (url.includes("Module:ChampionData")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "1": {
                  revisions: [
                    {
                      slots: {
                        main: {
                          "*": '\n  ["Ahri"] = {\n    ["skill_q"] = {\n      [1] = "Orb of Deception",\n    }\n  }',
                        },
                      },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });
  }

  it("persists parsed changes via a single prisma transaction (idempotent: pre-deletes existing)", async () => {
    vi.stubGlobal(
      "fetch",
      mockWikitext(
        "== Champions ==\n=== Ahri ===\n* '''Q - Orb of Deception''': Damage increased to 50 from 40."
      )
    );
    const prisma = makePrisma();
    const tx = prisma.$transaction;
    await makeService(prisma).syncVersion("26.10");
    expect(tx).toHaveBeenCalledOnce();
  });

  it("throws when the wiki returns an error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: "missingtitle", info: "Page not found" } }),
            { status: 200 }
          )
        )
    );
    const prisma = makePrisma();
    await expect(makeService(prisma).syncVersion("99.99")).rejects.toThrow(
      /wiki error missingtitle/
    );
  });

  it("throws when the wiki HTTP request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("oops", { status: 500 }))
    );
    const prisma = makePrisma();
    await expect(makeService(prisma).syncVersion("26.10")).rejects.toThrow(
      /wiki parse HTTP 500/
    );
  });

  it("throws when wikitext is missing from the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ parse: { title: "V26.10" } }), { status: 200 })
        )
    );
    const prisma = makePrisma();
    await expect(makeService(prisma).syncVersion("26.10")).rejects.toThrow(/no wikitext/);
  });

  it("resolves champion ability slot + CDragon icon when fullDdragonVersion is given", async () => {
    const wikitext =
      "== Champions ==\n;{{ci|Ahri}}\n* {{ai|Orb of Deception|Ahri}}\n** Damage increased to 50 from 40.\n== Items ==\n;{{ii|Lich Bane}}\n* Movement speed increased to 6% from 4%.\n== Runes ==\n;{{ri|Phase Rush}}\n* Base damage reduced.\n";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: unknown) => {
        const url = String(input);
        if (url.includes("wiki.leagueoflegends.com/api.php") && url.includes("page=")) {
          return new Response(
            JSON.stringify({
              parse: { title: "V26.10", wikitext: { "*": wikitext } },
            }),
            { status: 200 }
          );
        }
        if (url.includes("ddragon.leagueoflegends.com/cdn/")) {
          return new Response(
            JSON.stringify({
              data: {
                Ahri: { name: "Ahri" },
                MonkeyKing: { name: "Wukong" },
              },
            }),
            { status: 200 }
          );
        }
        if (url.includes("Module:ChampionData")) {
          return new Response(
            JSON.stringify({
              query: {
                pages: {
                  "1": {
                    revisions: [
                      {
                        slots: {
                          main: {
                            "*":
                              '\n  ["Ahri"] = {\n' +
                              '    ["skill_q"] = {\n' +
                              '      [1] = "Orb of Deception",\n' +
                              "    }\n" +
                              "  }",
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );

    const prisma = makePrisma();
    await makeService(prisma).syncVersion("26.10", "16.10.1");

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.patchChange.createMany).toHaveBeenCalledOnce();
    const createCall = prisma.patchChange.createMany.mock.calls[0]?.[0] as {
      data: Array<{
        section: string;
        subject: string;
        ability: string | null;
        slot: string | null;
        iconPath: string | null;
      }>;
    };
    const rows = createCall.data;

    const ahri = rows.find((r) => r.subject === "Ahri");
    expect(ahri?.slot).toBe("Q");
    expect(ahri?.iconPath).toBe(
      "https://cdn.communitydragon.org/latest/champion/Ahri/ability-icon/q"
    );

    const lichBane = rows.find((r) => r.subject === "Lich Bane");
    expect(lichBane?.section).toBe("item");
    expect(lichBane?.iconPath).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Lich_Bane_item.png"
    );

    const phaseRush = rows.find((r) => r.subject === "Phase Rush");
    expect(phaseRush?.section).toBe("rune");
    expect(phaseRush?.iconPath).toBe(
      "https://wiki.leagueoflegends.com/en-us/images/Phase_Rush_rune.png"
    );
  });

  it("leaves ability slot null when the ability is 'Base' (skipped resolution)", async () => {
    const wikitext =
      "== Champions ==\n;{{ci|Ahri}}\n* {{ai|Base|Ahri}}\n** Base stat tweak.\n";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: unknown) => {
        const url = String(input);
        if (url.includes("wiki.leagueoflegends.com/api.php") && url.includes("page=")) {
          return new Response(
            JSON.stringify({
              parse: { title: "V26.10", wikitext: { "*": wikitext } },
            }),
            { status: 200 }
          );
        }
        if (url.includes("ddragon.leagueoflegends.com/cdn/")) {
          return new Response(JSON.stringify({ data: { Ahri: { name: "Ahri" } } }), {
            status: 200,
          });
        }
        if (url.includes("Module:ChampionData")) {
          return new Response(
            JSON.stringify({
              query: {
                pages: {
                  "1": {
                    revisions: [
                      {
                        slots: {
                          main: {
                            "*": '\n  ["Ahri"] = {\n    ["skill_q"] = {\n      [1] = "Orb of Deception",\n    }\n  }',
                          },
                        },
                      },
                    ],
                  },
                },
              },
            }),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );

    const prisma = makePrisma();
    await makeService(prisma).syncVersion("26.10", "16.10.1");
    const createCall = prisma.patchChange.createMany.mock.calls[0]?.[0] as {
      data: Array<{ ability: string | null; slot: string | null }>;
    };
    const baseRow = createCall.data.find((r) => r.ability === "Base");
    expect(baseRow?.slot).toBeNull();
  });

  it("warns and proceeds when champion ability data fetch fails (no slot annotation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: unknown) => {
        const url = String(input);
        if (url.includes("wiki.leagueoflegends.com/api.php") && url.includes("page=")) {
          return new Response(
            JSON.stringify({
              parse: {
                title: "V26.10",
                wikitext: {
                  "*": "== Champions ==\n=== Ahri ===\n* '''Q - Orb of Deception''': Damage increased.",
                },
              },
            }),
            { status: 200 }
          );
        }
        // Fail ability data fetches
        return new Response("nope", { status: 500 });
      })
    );
    const prisma = makePrisma();
    const tx = prisma.$transaction;
    await makeService(prisma).syncVersion("26.10", "16.10.1");
    expect(tx).toHaveBeenCalledOnce();
  });
});

describe("PatchService.cronTick", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("swallows errors thrown by the underlying sync", async () => {
    // fetchVersionList throws → cronTick should catch.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const prisma = makePrisma();
    await expect(makeService(prisma).cronTick()).resolves.toBeUndefined();
  });
});

describe("PatchService.getChangesForVersion", () => {
  it("returns null patchVersion + empty section arrays when the requested version isn't in the DB", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findUnique.mockResolvedValue(null);

    const result = await makeService(prisma).getChangesForVersion("99.9");

    expect(result).toEqual({
      patchVersion: null,
      champions: [],
      items: [],
      runes: [],
    });
    expect(prisma.patchChange.findMany).not.toHaveBeenCalled();
  });

  it("partitions rows into champions/items/runes and groups each section by subject", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findUnique.mockResolvedValue({ version: "26.10" });
    prisma.patchChange.findMany.mockResolvedValue([
      {
        section: "champion",
        subject: "Ahri",
        ability: "Q",
        changeText: "Damage increased to 50 from 40.",
        changeType: "buff",
      },
      {
        section: "champion",
        subject: "Yasuo",
        ability: "Passive",
        changeText: "Shield reduced to 100 from 120.",
        changeType: "nerf",
      },
      {
        section: "item",
        subject: "Lich Bane",
        ability: null,
        changeText: "Movement speed increased to 6% from 4%.",
        changeType: "buff",
      },
      {
        section: "item",
        subject: "Lich Bane",
        ability: null,
        changeText: "Cost reduced to 3000 from 3200.",
        changeType: "buff",
      },
      {
        section: "rune",
        subject: "Deathfire Touch",
        ability: null,
        changeText: "Base damage reduced.",
        changeType: "nerf",
      },
    ]);

    const result = await makeService(prisma).getChangesForVersion("26.10");

    expect(result.patchVersion).toBe("26.10");
    expect(result.champions).toHaveLength(2);
    expect(result.champions[0]?.champion).toBe("Ahri");
    expect(result.champions[1]?.champion).toBe("Yasuo");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Lich Bane");
    expect(result.items[0]?.changes).toHaveLength(2);
    expect(result.runes).toHaveLength(1);
    expect(result.runes[0]?.name).toBe("Deathfire Touch");
    expect(prisma.patchChange.findMany).toHaveBeenCalledWith({
      where: { patchVersion: "26.10" },
      orderBy: [{ section: "asc" }, { subject: "asc" }, { id: "asc" }],
    });
  });
});
