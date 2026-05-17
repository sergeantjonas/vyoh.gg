import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { PatchService, truncateVersion, wikiPageTitle } from "./patch.service";

interface PatchPrismaStubs {
  patchVersion: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  championPatchChange: { findMany: ReturnType<typeof vi.fn> };
}

function makePrisma(): PatchPrismaStubs {
  return {
    patchVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    championPatchChange: { findMany: vi.fn() },
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
    expect(prisma.championPatchChange.findMany).not.toHaveBeenCalled();
  });

  it("returns the patch version with empty changes when no champion filter is given", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findFirst.mockResolvedValue({ version: "26.10" });

    const result = await makeService(prisma).getCurrentChanges([]);

    // Skip the DB hit entirely — PN2 always passes a filter, and an empty
    // filter is a "tell me the patch label" probe, not a request for the
    // entire patch's changes.
    expect(result).toEqual({ patchVersion: "26.10", changes: [] });
    expect(prisma.championPatchChange.findMany).not.toHaveBeenCalled();
  });

  it("groups rows by champion and preserves DB order within each group", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findFirst.mockResolvedValue({ version: "26.10" });
    prisma.championPatchChange.findMany.mockResolvedValue([
      {
        championKey: "Ahri",
        ability: "Q",
        changeText: "Damage increased to 50 from 40.",
        changeType: "buff",
      },
      {
        championKey: "Ahri",
        ability: "Q",
        changeText: "Cooldown reduced to 7 from 8.",
        changeType: "buff",
      },
      {
        championKey: "Lee Sin",
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
    expect(prisma.championPatchChange.findMany).toHaveBeenCalledWith({
      where: { patchVersion: "26.10", championKey: { in: ["Ahri", "Lee Sin"] } },
      orderBy: [{ championKey: "asc" }, { id: "asc" }],
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
      orderBy: { fetchedAt: "desc" },
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
      orderBy: { fetchedAt: "desc" },
      take: 3,
    });
  });
});

describe("PatchService.getChangesForVersion", () => {
  it("returns null patchVersion when the requested version isn't in the DB", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findUnique.mockResolvedValue(null);

    const result = await makeService(prisma).getChangesForVersion("99.9");

    expect(result).toEqual({ patchVersion: null, changes: [] });
    expect(prisma.championPatchChange.findMany).not.toHaveBeenCalled();
  });

  it("returns every change for the version, grouped by champion", async () => {
    const prisma = makePrisma();
    prisma.patchVersion.findUnique.mockResolvedValue({ version: "26.10" });
    prisma.championPatchChange.findMany.mockResolvedValue([
      {
        championKey: "Ahri",
        ability: "Q",
        changeText: "Damage increased to 50 from 40.",
        changeType: "buff",
      },
      {
        championKey: "Yasuo",
        ability: "Passive",
        changeText: "Shield reduced to 100 from 120.",
        changeType: "nerf",
      },
    ]);

    const result = await makeService(prisma).getChangesForVersion("26.10");

    expect(result.patchVersion).toBe("26.10");
    expect(result.changes).toHaveLength(2);
    expect(result.changes[0]?.champion).toBe("Ahri");
    expect(result.changes[1]?.champion).toBe("Yasuo");
    expect(prisma.championPatchChange.findMany).toHaveBeenCalledWith({
      where: { patchVersion: "26.10" },
      orderBy: [{ championKey: "asc" }, { id: "asc" }],
    });
  });
});
