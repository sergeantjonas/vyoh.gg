import { describe, expect, it, vi } from "vitest";
import type { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { HomeFirstPlayedService } from "./home-first-played.service";

function makeService(opts: {
  matches?: unknown[];
  snapshots?: unknown[];
  summoner?: unknown;
  accounts?: { gameName: string; tagLine: string; region: string; slug: string }[];
  resolvableSummoners?: { puuid: string }[];
}) {
  const prisma = {
    summoner: {
      findMany: vi.fn().mockResolvedValue(opts.resolvableSummoners ?? []),
      findUnique: vi.fn().mockResolvedValue(opts.summoner ?? null),
    },
    match: { findMany: vi.fn().mockResolvedValue(opts.matches ?? []) },
    steamPlaytimeSnapshot: {
      findMany: vi.fn().mockResolvedValue(opts.snapshots ?? []),
    },
  };
  const identity = {
    getLolAccounts: vi.fn().mockReturnValue(opts.accounts ?? []),
  };
  return {
    service: new HomeFirstPlayedService(
      prisma as unknown as PrismaService,
      identity as unknown as IdentityService
    ),
    prisma,
    identity,
  };
}

describe("HomeFirstPlayedService.getFirstPlayed", () => {
  it("returns { kind: 'none' } when there are no matches and no snapshots", async () => {
    const { service } = makeService({});
    const result = await service.getFirstPlayed();
    expect(result.kind).toBe("none");
  });

  it("resolves the lol slug from the configured accounts list when the summoner matches", async () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      accounts: [{ gameName: "Vyoh", tagLine: "EUW", region: "euw1", slug: "vyoh-euw" }],
      resolvableSummoners: [{ puuid: "p1" }],
      matches: [
        {
          matchId: "EUW1_1",
          champion: "Ahri",
          playedAt: recent,
          win: true,
          puuid: "p1",
        },
      ],
      summoner: { gameName: "Vyoh", tagLine: "EUW", region: "euw1" },
    });
    const result = await service.getFirstPlayed();
    expect(result.kind).toBe("lol");
    if (result.kind === "lol") {
      expect(result.accountSlug).toBe("vyoh-euw");
      expect(result.champion).toBe("Ahri");
    }
  });

  it("returns slug=null when the summoner is not in the configured accounts list", async () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const { service } = makeService({
      accounts: [],
      resolvableSummoners: [{ puuid: "p1" }],
      matches: [
        {
          matchId: "EUW1_1",
          champion: "Ahri",
          playedAt: recent,
          win: true,
          puuid: "p1",
        },
      ],
      summoner: { gameName: "Vyoh", tagLine: "EUW", region: "euw1" },
    });
    const result = await service.getFirstPlayed();
    if (result.kind === "lol") expect(result.accountSlug).toBeNull();
  });
});
