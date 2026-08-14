import type { LolAccount } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { IdentityService } from "./identity.service";

const roster: LolAccount[] = [
  { slug: "ahri", gameName: "Vyoh", tagLine: "Ahri", region: "euw1" },
  { slug: "tifa", gameName: "TIFA", tagLine: "7777", region: "euw1" },
];

// `syncPaused` has no counterpart on `LolAccount` by design — it never reaches
// the payload — so fixtures need their own shape to express a paused row.
type RosterFixture = LolAccount & { syncPaused?: boolean };

// `LolAccount` rows as Prisma returns them: the roster columns the service
// projects from, plus the bookkeeping columns it has to drop. `createdAt`
// is staggered because that is what the read orders on.
function rosterRows(accounts: RosterFixture[]) {
  return accounts.map((a, i) => {
    const at = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
    return {
      slug: a.slug,
      gameName: a.gameName,
      tagLine: a.tagLine,
      region: a.region,
      isOwner: a.isOwner === true,
      isPrimary: a.isPrimary === true,
      hiddenAt: a.hidden === true ? at : null,
      syncPausedAt: a.syncPaused === true ? at : null,
      createdAt: at,
      updatedAt: at,
    };
  });
}

// The cached shape for an account: every flag resolved to an explicit
// boolean, no timestamps.
function cached(account: RosterFixture): LolAccount {
  return {
    slug: account.slug,
    gameName: account.gameName,
    tagLine: account.tagLine,
    region: account.region,
    isOwner: account.isOwner === true,
    isPrimary: account.isPrimary === true,
    hidden: account.hidden === true,
  };
}

function stubPrisma(
  opts: { lol?: RosterFixture[]; steam?: string[]; summoners?: unknown[] } = {}
) {
  const summonerFindMany = vi.fn().mockResolvedValue(opts.summoners ?? []);
  const lolFindMany = vi.fn().mockResolvedValue(rosterRows(opts.lol ?? []));
  const steamFindMany = vi.fn().mockResolvedValue(
    (opts.steam ?? []).map((steamId64, i) => ({
      steamId64,
      isOwner: true,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    }))
  );
  const prisma = {
    summoner: { findMany: summonerFindMany },
    lolAccount: { findMany: lolFindMany },
    steamAccount: { findMany: steamFindMany },
  } as unknown as PrismaService;
  return { prisma, summonerFindMany, lolFindMany, steamFindMany };
}

async function bootedService(
  opts: { lol?: RosterFixture[]; steam?: string[]; summoners?: unknown[] } = {}
) {
  const stub = stubPrisma(opts);
  const service = new IdentityService(stub.prisma);
  await service.onModuleInit();
  return { service, ...stub };
}

describe("IdentityService", () => {
  it("returns the roster loaded from the database", async () => {
    const { service } = await bootedService({ lol: roster });
    expect(service.getLolAccounts()).toEqual(roster.map(cached));
  });

  it("returns the steam ids loaded from the database", async () => {
    const { service } = await bootedService({ steam: ["7656119"] });
    expect(service.getSteamIds()).toEqual(["7656119"]);
  });

  it("recognizes a whitelisted account case-insensitively", async () => {
    const { service } = await bootedService({ lol: roster });
    expect(service.isLolAccountAllowed("vyoh", "ahri", "EUW1")).toBe(true);
    expect(service.isLolAccountAllowed("Vyoh", "Ahri", "euw1")).toBe(true);
  });

  it("rejects an account that is not in the whitelist", async () => {
    const { service } = await bootedService({ lol: roster });
    expect(service.isLolAccountAllowed("Foo", "Bar", "euw1")).toBe(false);
    expect(service.isLolAccountAllowed("Vyoh", "Ahri", "na1")).toBe(false);
  });

  it("finds an account by slug", async () => {
    const { service } = await bootedService({ lol: roster });
    expect(service.findBySlug("ahri")?.gameName).toBe("Vyoh");
    expect(service.findBySlug("AHRI")?.gameName).toBe("Vyoh");
    expect(service.findBySlug("missing")).toBeUndefined();
  });

  it("getOwnerPuuids returns [] when no isOwner accounts are in the roster", async () => {
    const { service, summonerFindMany } = await bootedService({
      lol: [{ slug: "alt", gameName: "X", tagLine: "1", region: "euw1" }],
    });
    expect(await service.getOwnerPuuids()).toEqual([]);
    // No Prisma round-trip when there are no owner accounts to look up.
    expect(summonerFindMany).not.toHaveBeenCalled();
  });

  it("getOwnerPuuids resolves Summoner.puuid for isOwner accounts only", async () => {
    const { service, summonerFindMany } = await bootedService({
      lol: [
        {
          slug: "main",
          gameName: "Vyoh",
          tagLine: "Ahri",
          region: "euw1",
          isOwner: true,
          isPrimary: true,
        },
        { slug: "alt", gameName: "Vyoh", tagLine: "Alt", region: "euw1", isOwner: true },
        // Non-owner — should NOT appear in the where clause.
        { slug: "tifa", gameName: "TIFA", tagLine: "7777", region: "euw1" },
      ],
      summoners: [{ puuid: "P_main" }, { puuid: "P_alt" }],
    });
    expect(await service.getOwnerPuuids()).toEqual(["P_main", "P_alt"]);
    // Owner-only lookup — the OR clause should have exactly 2 entries, not 3.
    expect(summonerFindMany).toHaveBeenCalledTimes(1);
    const call = summonerFindMany.mock.calls[0]?.[0] as { where: { OR: unknown[] } };
    expect(call.where.OR).toHaveLength(2);
  });

  describe("reload", () => {
    it("populates the cache from the database on module init", async () => {
      const { service, lolFindMany, steamFindMany } = await bootedService({
        lol: roster,
        steam: ["7656119"],
      });
      expect(lolFindMany).toHaveBeenCalledTimes(1);
      expect(steamFindMany).toHaveBeenCalledTimes(1);
      expect(service.getLolAccounts()).toHaveLength(2);
      expect(service.getSteamIds()).toEqual(["7656119"]);
    });

    it("serves an empty roster until the first reload resolves", () => {
      const { prisma } = stubPrisma({ lol: roster, steam: ["7656119"] });
      const service = new IdentityService(prisma);
      // Construction does not query — every read is empty until onModuleInit.
      expect(service.getLolAccounts()).toEqual([]);
      expect(service.getSteamIds()).toEqual([]);
    });

    it("reads the roster in createdAt order so /me keeps a stable account order", async () => {
      const { lolFindMany, steamFindMany } = await bootedService({ lol: roster });
      expect(lolFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
      expect(steamFindMany).toHaveBeenCalledWith({ orderBy: { createdAt: "asc" } });
    });

    it("drops the roster bookkeeping columns so they never reach /me", async () => {
      const { service } = await bootedService({ lol: roster });
      const account = service.getLolAccounts()[0];
      expect(account).not.toHaveProperty("createdAt");
      expect(account).not.toHaveProperty("updatedAt");
      expect(Object.keys(account ?? {}).sort()).toEqual([
        "gameName",
        "hidden",
        "isOwner",
        "isPrimary",
        "region",
        "slug",
        "tagLine",
      ]);
    });

    it("keeps the pause state out of the projection entirely", async () => {
      // `hidden` is public — the nav needs it. Whether an account is still
      // being fetched is an ops detail with no place in a visitor's payload,
      // so neither the column nor a derived flag may survive the projection.
      const { service } = await bootedService({
        lol: [{ ...roster[0], syncPaused: true } as RosterFixture],
      });
      const account = service.getLolAccounts()[0];
      expect(account).not.toHaveProperty("syncPausedAt");
      expect(account).not.toHaveProperty("syncPaused");
      expect(account).toHaveProperty("hidden", false);
    });

    it("derives hidden from the hiddenAt timestamp", async () => {
      const { service } = await bootedService({
        lol: [roster[0] as LolAccount, { ...roster[1], hidden: true } as RosterFixture],
      });
      expect(service.getLolAccounts().map((a) => [a.slug, a.hidden])).toEqual([
        ["ahri", false],
        ["tifa", true],
      ]);
    });

    it("replaces the cache on a second call rather than appending to it", async () => {
      const { service, lolFindMany, steamFindMany } = await bootedService({
        lol: roster,
        steam: ["7656119"],
      });
      lolFindMany.mockResolvedValue(
        rosterRows([{ slug: "new", gameName: "N", tagLine: "1", region: "euw1" }])
      );
      steamFindMany.mockResolvedValue([]);

      await service.reload();

      expect(service.getLolAccounts()).toEqual([
        cached({ slug: "new", gameName: "N", tagLine: "1", region: "euw1" }),
      ]);
      expect(service.getSteamIds()).toEqual([]);
      // The account the roster no longer carries stops being whitelisted.
      expect(service.isLolAccountAllowed("Vyoh", "Ahri", "euw1")).toBe(false);
      expect(service.findBySlug("ahri")).toBeUndefined();
    });

    it("warns but still serves a roster that breaks the owner invariants", async () => {
      const { prisma } = stubPrisma({
        lol: [
          { slug: "a", gameName: "A", tagLine: "1", region: "euw1", isOwner: true },
          { slug: "b", gameName: "B", tagLine: "2", region: "euw1", isOwner: true },
        ],
      });
      const service = new IdentityService(prisma);
      const warn = vi
        .spyOn((service as unknown as { logger: { warn: () => void } }).logger, "warn")
        .mockImplementation(() => {});

      await expect(service.onModuleInit()).resolves.toBeUndefined();

      // Boot does not fail on bad data — the roster is still served, and the
      // breach is logged rather than swallowed.
      expect(service.getLolAccounts()).toHaveLength(2);
      const call = warn.mock.calls[0] as unknown as [string];
      expect(call[0]).toMatch(/isPrimary/);
    });
  });

  describe("assertRosterInvariants", () => {
    it("accepts exactly one isOwner+isPrimary account alongside test data", async () => {
      const { service } = await bootedService();
      expect(() =>
        service.assertRosterInvariants([
          {
            slug: "main",
            gameName: "A",
            tagLine: "1",
            region: "euw1",
            isOwner: true,
            isPrimary: true,
          },
          { slug: "alt", gameName: "B", tagLine: "2", region: "euw1", isOwner: true },
          { slug: "test", gameName: "C", tagLine: "3", region: "euw1" },
        ])
      ).not.toThrow();
    });

    it("rejects a roster with owner accounts but no primary — recap would have no main subject", async () => {
      const { service } = await bootedService();
      expect(() =>
        service.assertRosterInvariants([
          { slug: "a", gameName: "A", tagLine: "1", region: "euw1", isOwner: true },
          { slug: "b", gameName: "B", tagLine: "2", region: "euw1", isOwner: true },
        ])
      ).toThrow(/isPrimary/);
    });

    it("rejects slugs that collide case-insensitively, which the primary key allows", async () => {
      const { service } = await bootedService();
      expect(() =>
        service.assertRosterInvariants([
          { slug: "main", gameName: "A", tagLine: "1", region: "euw1" },
          { slug: "Main", gameName: "B", tagLine: "2", region: "euw1" },
        ])
      ).toThrow(/Duplicate slug "Main"/);
    });

    it("rejects hiding the primary account, whose page the landing page is built on", async () => {
      const { service } = await bootedService();
      expect(() =>
        service.assertRosterInvariants([
          {
            slug: "main",
            gameName: "A",
            tagLine: "1",
            region: "euw1",
            isOwner: true,
            isPrimary: true,
            hidden: true,
          },
        ])
      ).toThrow(/must stay visible/);
    });

    it("accepts hiding a non-primary owner account", async () => {
      const { service } = await bootedService();
      expect(() =>
        service.assertRosterInvariants([
          {
            slug: "main",
            gameName: "A",
            tagLine: "1",
            region: "euw1",
            isOwner: true,
            isPrimary: true,
          },
          {
            slug: "alt",
            gameName: "B",
            tagLine: "2",
            region: "euw1",
            isOwner: true,
            hidden: true,
          },
        ])
      ).not.toThrow();
    });
  });

  // One case per row of the read-path table in accounts-admin.md. Only the sync
  // worklist narrows; every other read stays deliberately blind to both columns,
  // and a read that silently starts or stops honouring them has no symptom a
  // visitor would ever report.
  describe("hidden and paused accounts across the read path", () => {
    const mixed: RosterFixture[] = [
      { slug: "visible", gameName: "A", tagLine: "1", region: "euw1" },
      { slug: "hidden", gameName: "B", tagLine: "2", region: "euw1", hidden: true },
      { slug: "paused", gameName: "C", tagLine: "3", region: "euw1", syncPaused: true },
    ];

    it("getSyncableLolAccounts excludes paused accounts and keeps hidden ones", async () => {
      const { service } = await bootedService({ lol: mixed });
      expect(service.getSyncableLolAccounts().map((a) => a.slug)).toEqual([
        "visible",
        "hidden",
      ]);
    });

    it("getLolAccounts stays the unfiltered roster", async () => {
      // The backfill scripts and the puuid→slug reverse lookup iterate this;
      // narrowing it would make maintenance work skip accounts in silence.
      const { service } = await bootedService({ lol: mixed });
      expect(service.getLolAccounts().map((a) => a.slug)).toEqual([
        "visible",
        "hidden",
        "paused",
      ]);
    });

    it("isLolAccountAllowed admits hidden and paused accounts", async () => {
      // Both states keep every page serving. Gating reads here would 404 the
      // very history the two features exist to preserve.
      const { service } = await bootedService({ lol: mixed });
      expect(service.isLolAccountAllowed("B", "2", "euw1")).toBe(true);
      expect(service.isLolAccountAllowed("C", "3", "euw1")).toBe(true);
    });

    it("findBySlug resolves hidden and paused accounts so bookmarks keep working", async () => {
      const { service } = await bootedService({ lol: mixed });
      expect(service.findBySlug("hidden")?.slug).toBe("hidden");
      expect(service.findBySlug("paused")?.slug).toBe("paused");
    });

    it("getOwnerPuuids ignores hidden, so hiding cannot move the landing page totals", async () => {
      const { service } = await bootedService({
        lol: [
          {
            slug: "main",
            gameName: "A",
            tagLine: "1",
            region: "euw1",
            isOwner: true,
            isPrimary: true,
          },
          {
            slug: "alt",
            gameName: "B",
            tagLine: "2",
            region: "euw1",
            isOwner: true,
            hidden: true,
          },
        ],
        summoners: [{ puuid: "p-main" }, { puuid: "p-alt" }],
      });
      expect(await service.getOwnerPuuids()).toEqual(["p-main", "p-alt"]);
    });

    it("a paused account still leaves the worklist after it resumes", async () => {
      const { service, lolFindMany } = await bootedService({ lol: mixed });
      lolFindMany.mockResolvedValue(
        rosterRows(mixed.map((a) => ({ ...a, syncPaused: false })))
      );
      await service.reload();
      expect(service.getSyncableLolAccounts()).toHaveLength(3);
    });
  });

  describe("getLolAccountsWithSummary", () => {
    it("returns summary: null and profileIconId: null for accounts without a Summoner row", async () => {
      const { service } = await bootedService({ lol: roster });
      const result = await service.getLolAccountsWithSummary();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        slug: "ahri",
        profileIconId: null,
        summary: null,
      });
      expect(result[1]).toMatchObject({
        slug: "tifa",
        profileIconId: null,
        summary: null,
      });
    });

    it("hydrates the denorm fields when the Summoner row carries them", async () => {
      const { service } = await bootedService({
        lol: roster,
        summoners: [
          {
            gameName: "Vyoh",
            tagLine: "Ahri",
            region: "euw1",
            profileIconId: 4567,
            currentRankTier: "GOLD",
            currentRankDivision: "II",
            currentRankLp: 50,
            currentRankQueue: "RANKED_SOLO_5x5",
            lastPlayedChampionAlias: "Ahri",
            summaryUpdatedAt: new Date("2026-05-24T10:00:00Z"),
          },
        ],
      });
      const result = await service.getLolAccountsWithSummary();
      expect(result[0]?.profileIconId).toBe(4567);
      expect(result[0]?.summary).toEqual({
        rank: {
          tier: "GOLD",
          division: "II",
          leaguePoints: 50,
          queueId: "RANKED_SOLO_5x5",
        },
        lastPlayedChampionAlias: "Ahri",
        updatedAt: "2026-05-24T10:00:00.000Z",
      });
      // Second account has no matching Summoner row → still null
      expect(result[1]?.profileIconId).toBeNull();
      expect(result[1]?.summary).toBeNull();
    });

    it("reports rank: null when the Summoner row exists but no rank fields are set", async () => {
      // Account resolved (Summoner row exists) but the rank-snapshot path
      // hasn't run yet, so the denorm rank columns are still null. The
      // `summary.updatedAt` field tells the UI the refresh has run at
      // least once even if there's no rank to show.
      const { service } = await bootedService({
        lol: roster,
        summoners: [
          {
            gameName: "Vyoh",
            tagLine: "Ahri",
            region: "euw1",
            currentRankTier: null,
            currentRankDivision: null,
            currentRankLp: null,
            currentRankQueue: null,
            lastPlayedChampionAlias: "Yasuo",
            summaryUpdatedAt: new Date("2026-05-24T10:00:00Z"),
          },
        ],
      });
      const result = await service.getLolAccountsWithSummary();
      expect(result[0]?.summary).toEqual({
        rank: null,
        lastPlayedChampionAlias: "Yasuo",
        updatedAt: "2026-05-24T10:00:00.000Z",
      });
    });

    it("skips the Prisma round-trip when the roster is empty", async () => {
      const { service, summonerFindMany } = await bootedService();
      expect(await service.getLolAccountsWithSummary()).toEqual([]);
      expect(summonerFindMany).not.toHaveBeenCalled();
    });
  });
});
