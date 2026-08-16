import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdentityService } from "../identity/identity.service";
import type { PrismaService } from "../prisma/prisma.service";
import { RiotError } from "../riot/riot.error";
import type { RiotService } from "../riot/riot.service";
import { AdminAccountsService } from "./admin-accounts.service";

interface RowSeed {
  slug: string;
  gameName?: string;
  tagLine?: string;
  region?: string;
  isOwner?: boolean;
  isPrimary?: boolean;
  hiddenAt?: Date | null;
  syncPausedAt?: Date | null;
}

type PurgeStep =
  | "match"
  | "rankSnapshot"
  | "summoner"
  | "detailCache"
  | "timelineCache"
  | "rosterRow";

interface PreviewRow {
  matches: number;
  rankSnapshots: number;
  detailCacheRows: number;
  timelineCacheRows: number;
  matchAvgBytes: number;
  rankSnapshotAvgBytes: number;
  detailAvgBytes: number;
  timelineAvgBytes: number;
}

const EMPTY_PREVIEW: PreviewRow = {
  matches: 0,
  rankSnapshots: 0,
  detailCacheRows: 0,
  timelineCacheRows: 0,
  matchAvgBytes: 0,
  rankSnapshotAvgBytes: 0,
  detailAvgBytes: 0,
  timelineAvgBytes: 0,
};

function rows(seed: RowSeed[]) {
  return seed.map((s, i) => ({
    slug: s.slug,
    gameName: s.gameName ?? s.slug.toUpperCase(),
    tagLine: s.tagLine ?? "EUW",
    region: s.region ?? "euw1",
    isOwner: s.isOwner === true,
    isPrimary: s.isPrimary === true,
    hiddenAt: s.hiddenAt ?? null,
    syncPausedAt: s.syncPausedAt ?? null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
  }));
}

/**
 * Stub of the queries this service issues, nothing more. Mutations record
 * rather than mutate: what each test needs to establish is which write was
 * issued, and whether the roster invariants let the request get that far. That
 * the cache picks a committed write up afterwards is `reload()`'s contract, and
 * `identity.service.spec.ts` owns it.
 */
function stubPrisma(
  seed: {
    lol?: RowSeed[];
    puuids?: string[];
    matchRows?: number;
    preview?: Partial<PreviewRow>;
    purged?: Partial<Record<PurgeStep, number>>;
  } = {}
) {
  const lolRows = rows(seed.lol ?? []);
  const find = (slug: string) => lolRows.find((r) => r.slug === slug);

  // Purge's correctness is an ordering property — the schema refuses a
  // `Summoner` that still has matches, and the cache sweep only spares a shared
  // game if it runs *after* the match delete. Neither survives a stubbed
  // Prisma, which happily executes the steps in any order, so the tests assert
  // the sequence the service issues and this log is what they read.
  const steps: PurgeStep[] = [];
  const count = (step: PurgeStep) => {
    steps.push(step);
    return seed.purged?.[step] ?? 0;
  };

  const prisma = {
    steps,
    lolAccount: {
      findMany: vi.fn().mockResolvedValue(lolRows),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const row = find(where.slug);
        if (!row) throw new Error(`no LolAccount row for "${where.slug}"`);
        return row;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...rows([{ slug: "created" }])[0],
        ...data,
      })),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { slug: string };
          data: Record<string, unknown>;
        }) => ({ ...rows([{ slug: where.slug }])[0], ...find(where.slug), ...data })
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn(async () => {
        steps.push("rosterRow");
        return undefined;
      }),
    },
    // Nothing in this service touches Steam — this is here because these tests
    // run against a real `IdentityService`, and every `reload()` reads both
    // tables to rebuild its cache.
    steamAccount: { findMany: vi.fn().mockResolvedValue([]) },
    summoner: {
      findMany: vi
        .fn()
        .mockResolvedValue((seed.puuids ?? []).map((puuid) => ({ puuid }))),
      deleteMany: vi.fn(async () => ({ count: count("summoner") })),
    },
    match: {
      count: vi.fn().mockResolvedValue(seed.matchRows ?? 0),
      deleteMany: vi.fn(async () => ({ count: count("match") })),
    },
    rankSnapshot: {
      deleteMany: vi.fn(async () => ({ count: count("rankSnapshot") })),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ ...EMPTY_PREVIEW, ...seed.preview }]),
    // Both cache sweeps are the same call with different SQL, so the step they
    // record has to come from the statement rather than from which mock ran.
    $executeRaw: vi.fn(async (sql: TemplateStringsArray) =>
      count(sql.join("").includes("MatchTimelineCache") ? "timelineCache" : "detailCache")
    ),
    // The callback receives the same stub, so a write inside the transaction
    // lands on the same mocks the assertions read.
    $transaction: vi.fn(),
  };
  prisma.$transaction = vi.fn(
    async (fn: (tx: typeof prisma) => Promise<unknown>, _options?: unknown) =>
      await fn(prisma)
  );
  return prisma;
}

const riotAccount = { puuid: "p-new", gameName: "Agurin", tagLine: "EUW" };

async function build(
  seed: Parameters<typeof stubPrisma>[0] = {},
  riotStub: Partial<RiotService> = {}
) {
  const prisma = stubPrisma(seed);
  // The real service, not a stub of it: these tests are as much about the roster
  // invariants actually rejecting a bad write as about which query is issued,
  // and stubbing `assertRosterInvariants` would assert the mock instead.
  const identity = new IdentityService(prisma as unknown as PrismaService);
  await identity.onModuleInit();
  const reload = vi.spyOn(identity, "reload");
  const riot = {
    getAccountByRiotId: vi.fn().mockResolvedValue(riotAccount),
    ...riotStub,
  } as unknown as RiotService;
  const service = new AdminAccountsService(
    prisma as unknown as PrismaService,
    identity,
    riot
  );
  return { service, prisma, identity, reload, riot };
}

// A roster the owner invariants accept: one owner+primary, one tracked friend.
const PRIMARY: RowSeed = {
  slug: "ahri",
  gameName: "Vyoh",
  tagLine: "Ahri",
  isOwner: true,
  isPrimary: true,
};
const FRIEND: RowSeed = { slug: "twix", gameName: "Twix", tagLine: "1234" };
const ROSTER: RowSeed[] = [PRIMARY, FRIEND];

describe("AdminAccountsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reads", () => {
    it("serves the timestamps the public projection drops", async () => {
      const hiddenAt = new Date(Date.UTC(2026, 5, 1));
      const { service } = await build({
        lol: [PRIMARY, { slug: "twix", hiddenAt }],
      });

      const listed = await service.listLolAccounts();

      expect(listed[1]).toMatchObject({
        slug: "twix",
        hiddenAt: hiddenAt.toISOString(),
        syncPausedAt: null,
      });
      // Proof it read the DB rather than the roster cache: the cache carries a
      // `hidden` boolean and no timestamp at all, so an ISO string here can only
      // have come from the row.
      expect(listed[0]?.hiddenAt).toBeNull();
    });
  });

  describe("createLolAccount", () => {
    const dto = {
      slug: "agurin",
      gameName: "agurin",
      tagLine: "euw",
      region: "euw1",
    };

    it("stores Riot's canonical casing rather than what was typed", async () => {
      const { service, prisma, reload } = await build({ lol: ROSTER });

      const created = await service.createLolAccount(dto);

      expect(prisma.lolAccount.create).toHaveBeenCalledWith({
        data: {
          slug: "agurin",
          gameName: "Agurin",
          tagLine: "EUW",
          region: "euw1",
          isOwner: false,
          isPrimary: false,
        },
      });
      expect(created.gameName).toBe("Agurin");
      expect(reload).toHaveBeenCalledOnce();
    });

    it("leaves the incumbent primary alone on an ordinary create", async () => {
      // Demoting unconditionally would propose a roster with owners and no
      // primary, so an ordinary create would 400 on a rule it never touched.
      const { service, prisma } = await build({ lol: ROSTER });
      await service.createLolAccount(dto);
      expect(prisma.lolAccount.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a slug already on the roster", async () => {
      const { service, prisma } = await build({ lol: ROSTER });
      await expect(service.createLolAccount({ ...dto, slug: "twix" })).rejects.toThrow(
        ConflictException
      );
      expect(prisma.lolAccount.create).not.toHaveBeenCalled();
    });

    it("rejects a Riot ID already tracked, case-insensitively", async () => {
      const { service, prisma } = await build({ lol: ROSTER });
      // The `@@unique` constraint is case-sensitive; this check is what stops
      // one account's history being split across two half-synced pages.
      await expect(
        service.createLolAccount({ ...dto, gameName: "TWIX", tagLine: "1234" })
      ).rejects.toThrow(ConflictException);
      expect(prisma.lolAccount.create).not.toHaveBeenCalled();
    });

    it("turns an unknown Riot ID into a 400 the form can render", async () => {
      const { service, prisma } = await build(
        { lol: ROSTER },
        {
          getAccountByRiotId: vi
            .fn()
            .mockRejectedValue(new RiotError("not found", 404, "/account")),
        }
      );

      await expect(service.createLolAccount(dto)).rejects.toThrow(BadRequestException);
      expect(prisma.lolAccount.create).not.toHaveBeenCalled();
    });

    it("lets a rate-limited lookup through to the Riot filter", async () => {
      // 429 and 5xx are retry-shaped, and `RiotExceptionFilter` already maps
      // them. Swallowing them into a 400 would tell the owner their Riot ID is
      // wrong when the upstream is simply busy.
      const { service } = await build(
        { lol: ROSTER },
        {
          getAccountByRiotId: vi
            .fn()
            .mockRejectedValue(new RiotError("rate limited", 429, "/account")),
        }
      );

      await expect(service.createLolAccount(dto)).rejects.toThrow(RiotError);
    });

    it("refuses a roster the owner invariants reject", async () => {
      const { service, prisma } = await build({ lol: ROSTER });
      await expect(service.createLolAccount({ ...dto, isPrimary: true })).rejects.toThrow(
        /isPrimary without isOwner/
      );
      expect(prisma.lolAccount.create).not.toHaveBeenCalled();
    });

    it("demotes the incumbent primary when the new account claims it", async () => {
      const { service, prisma } = await build({ lol: ROSTER });

      await service.createLolAccount({ ...dto, isOwner: true, isPrimary: true });

      expect(prisma.lolAccount.updateMany).toHaveBeenCalledWith({
        where: { isPrimary: true },
        data: { isPrimary: false },
      });
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });
  });

  describe("updateLolAccount", () => {
    it("400s a patch that names no fields", async () => {
      const { service } = await build({ lol: ROSTER });
      await expect(service.updateLolAccount("twix", {})).rejects.toThrow(
        BadRequestException
      );
    });

    it("404s an unknown slug", async () => {
      const { service } = await build({ lol: ROSTER });
      await expect(service.updateLolAccount("nobody", { hidden: true })).rejects.toThrow(
        NotFoundException
      );
    });

    it("stamps hiddenAt when hiding and nulls it when unhiding", async () => {
      const { service, prisma, reload } = await build({ lol: ROSTER });

      await service.updateLolAccount("twix", { hidden: true });
      expect(prisma.lolAccount.update).toHaveBeenCalledWith({
        where: { slug: "twix" },
        data: { hiddenAt: expect.any(Date) },
      });

      await service.updateLolAccount("twix", { hidden: false });
      expect(prisma.lolAccount.update).toHaveBeenLastCalledWith({
        where: { slug: "twix" },
        data: { hiddenAt: null },
      });
      expect(reload).toHaveBeenCalledTimes(2);
    });

    it("keeps the original timestamp when re-hiding an already-hidden account", async () => {
      const hiddenAt = new Date(Date.UTC(2026, 2, 3));
      const { service, prisma } = await build({
        lol: [PRIMARY, { slug: "twix", hiddenAt }],
      });

      await service.updateLolAccount("twix", { hidden: true });

      // "Hidden since when" is the question the column answers; a double-clicked
      // toggle must not reset it to now.
      expect(prisma.lolAccount.update).toHaveBeenCalledWith({
        where: { slug: "twix" },
        data: { hiddenAt },
      });
    });

    it("pauses and resumes sync independently of visibility", async () => {
      const { service, prisma } = await build({ lol: ROSTER });

      await service.updateLolAccount("twix", { syncPaused: true });
      expect(prisma.lolAccount.update).toHaveBeenCalledWith({
        where: { slug: "twix" },
        data: { syncPausedAt: expect.any(Date) },
      });

      await service.updateLolAccount("twix", { syncPaused: false });
      expect(prisma.lolAccount.update).toHaveBeenLastCalledWith({
        where: { slug: "twix" },
        data: { syncPausedAt: null },
      });
    });

    it("pauses the primary account — pausing carries no invariants", async () => {
      const { service, prisma } = await build({ lol: ROSTER });
      await service.updateLolAccount("ahri", { syncPaused: true });
      expect(prisma.lolAccount.update).toHaveBeenCalledOnce();
    });

    it("refuses to hide the primary account", async () => {
      const { service, prisma } = await build({ lol: ROSTER });
      await expect(service.updateLolAccount("ahri", { hidden: true })).rejects.toThrow(
        /isPrimary and hidden/
      );
      expect(prisma.lolAccount.update).not.toHaveBeenCalled();
    });

    it("refuses to unflag the only primary while owner accounts remain", async () => {
      const { service } = await build({
        lol: [...ROSTER, { slug: "alt", isOwner: true }],
      });
      await expect(
        service.updateLolAccount("ahri", { isPrimary: false })
      ).rejects.toThrow(/none is flagged isPrimary/);
    });

    it("promotes an account and demotes the incumbent in one transaction", async () => {
      const { service, prisma } = await build({
        lol: [...ROSTER, { slug: "alt", isOwner: true }],
      });

      await service.updateLolAccount("alt", { isPrimary: true });

      expect(prisma.lolAccount.updateMany).toHaveBeenCalledWith({
        where: { isPrimary: true, slug: { not: "alt" } },
        data: { isPrimary: false },
      });
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });
  });

  describe("deleteLolAccount", () => {
    it("404s an unknown slug", async () => {
      const { service } = await build({ lol: ROSTER });
      await expect(service.deleteLolAccount("nobody", false)).rejects.toThrow(
        NotFoundException
      );
    });

    it("refuses to delete the primary while another owner remains", async () => {
      const { service, prisma } = await build({
        lol: [...ROSTER, { slug: "alt", isOwner: true }],
      });
      await expect(service.deleteLolAccount("ahri", false)).rejects.toThrow(
        /none is flagged isPrimary/
      );
      expect(prisma.lolAccount.delete).not.toHaveBeenCalled();
    });

    it("refuses an account with history and reports how much", async () => {
      const { service, prisma } = await build({
        lol: ROSTER,
        puuids: ["p-twix"],
        matchRows: 1153,
      });

      await expect(service.deleteLolAccount("twix", false)).rejects.toThrow(/1153/);
      expect(prisma.lolAccount.delete).not.toHaveBeenCalled();
    });

    it("deletes forced, reporting the rows it strands", async () => {
      const { service, prisma, reload } = await build({
        lol: ROSTER,
        puuids: ["p-twix"],
        matchRows: 1153,
      });

      expect(await service.deleteLolAccount("twix", true)).toEqual({
        slug: "twix",
        matchRows: 1153,
      });
      expect(prisma.lolAccount.delete).toHaveBeenCalledWith({
        where: { slug: "twix" },
      });
      expect(reload).toHaveBeenCalledOnce();
    });

    it("deletes an account with no history without needing force", async () => {
      const { service, prisma } = await build({ lol: ROSTER, puuids: ["p-twix"] });
      expect(await service.deleteLolAccount("twix", false)).toEqual({
        slug: "twix",
        matchRows: 0,
      });
      expect(prisma.lolAccount.delete).toHaveBeenCalledOnce();
    });

    it("counts nothing for an account that never resolved a summoner", async () => {
      const { service, prisma } = await build({ lol: ROSTER, puuids: [] });
      await service.deleteLolAccount("twix", false);
      expect(prisma.match.count).not.toHaveBeenCalled();
    });

    it("deletes by the stored slug, not the casing the caller used", async () => {
      // `findBySlug` resolves case-insensitively while the primary key does not,
      // so deleting by what arrived can miss the row that was just validated.
      const { service, prisma } = await build({ lol: ROSTER });
      await service.deleteLolAccount("TWIX", false);
      expect(prisma.lolAccount.delete).toHaveBeenCalledWith({
        where: { slug: "twix" },
      });
    });
  });

  describe("purgePreview", () => {
    it("404s an unknown slug", async () => {
      const { service } = await build({ lol: ROSTER });
      await expect(service.purgePreview("nobody")).rejects.toThrow(NotFoundException);
    });

    it("reports per-table counts and sizes the deletes at average row width", async () => {
      const { service } = await build({
        lol: ROSTER,
        puuids: ["p-twix"],
        preview: {
          matches: 1153,
          rankSnapshots: 300,
          detailCacheRows: 1152,
          timelineCacheRows: 600,
          matchAvgBytes: 1890,
          rankSnapshotAvgBytes: 100,
          detailAvgBytes: 9000,
          timelineAvgBytes: 157115,
        },
      });

      expect(await service.purgePreview("twix")).toEqual({
        slug: "twix",
        gameName: "Twix",
        tagLine: "1234",
        region: "euw1",
        summoners: 1,
        matches: 1153,
        rankSnapshots: 300,
        detailCacheRows: 1152,
        timelineCacheRows: 600,
        estimatedBytes: 1153 * 1890 + 300 * 100 + 1152 * 9000 + 600 * 157115,
      });
    });

    it("previews an account that never resolved a summoner as empty", async () => {
      const { service } = await build({ lol: ROSTER, puuids: [] });
      expect(await service.purgePreview("twix")).toMatchObject({
        summoners: 0,
        matches: 0,
        estimatedBytes: 0,
      });
    });
  });

  describe("purgeAccount", () => {
    const HISTORY = {
      lol: ROSTER,
      puuids: ["p-twix"],
      purged: {
        match: 1153,
        rankSnapshot: 300,
        summoner: 1,
        detailCache: 1152,
        timelineCache: 600,
      },
    };

    it("404s an unknown slug", async () => {
      const { service } = await build({ lol: ROSTER });
      await expect(service.purgeAccount("nobody", "nobody")).rejects.toThrow(
        NotFoundException
      );
    });

    it("refuses a confirmation that names a different account", async () => {
      const { service, prisma } = await build(HISTORY);
      await expect(service.purgeAccount("twix", "ahri")).rejects.toThrow(
        BadRequestException
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("refuses to purge the primary while another owner remains", async () => {
      const { service, prisma } = await build({
        lol: [...ROSTER, { slug: "alt", isOwner: true }],
      });
      await expect(service.purgeAccount("ahri", "ahri")).rejects.toThrow(
        /none is flagged isPrimary/
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // The order is what the schema enforces and what the sweep depends on, and
    // it is the one property of this operation a stubbed Prisma can still see:
    // `Match` before `Summoner` because `Match_puuid_fkey` blocks the reverse,
    // and both cache sweeps after `Match` because a sweep that ran first would
    // find every row still referenced and delete nothing.
    it("deletes in the order the schema and the sweep require", async () => {
      const { service, prisma } = await build(HISTORY);
      await service.purgeAccount("twix", "twix");
      expect(prisma.steps).toEqual([
        "match",
        "rankSnapshot",
        "summoner",
        "detailCache",
        "timelineCache",
        "rosterRow",
      ]);
    });

    it("runs every delete in one transaction, with room to finish it", async () => {
      const { service, prisma } = await build(HISTORY);
      await service.purgeAccount("twix", "twix");

      expect(prisma.$transaction).toHaveBeenCalledOnce();
      // Above the ceiling the pool's own 10s `statement_timeout` implies across
      // these five statements, so the interactive-transaction default can never
      // be what stops a purge — Postgres killing one runaway statement is the
      // failure this should degrade to, not Prisma abandoning all of them.
      const [, options] = prisma.$transaction.mock.calls[0] ?? [];
      expect((options as { timeout?: number } | undefined)?.timeout).toBeGreaterThan(
        50_000
      );
    });

    it("sweeps the cache tables by orphan, not by the account's match ids", async () => {
      const { service, prisma } = await build(HISTORY);
      await service.purgeAccount("twix", "twix");

      // Whether a shared game keeps its cache row is decided entirely by this
      // predicate: `NOT IN (SELECT "matchId" FROM "Match")` spares one the other
      // roster account still references, while deleting by the purged account's
      // own match ids would take it. Verified against dev in a rolled-back
      // transaction — purging a 1,973-match account swept 1,972 detail rows.
      for (const [sql] of prisma.$executeRaw.mock.calls) {
        expect(sql.join("")).toMatch(/NOT IN \(\s*SELECT "matchId" FROM "Match"\s*\)/);
      }
    });

    it("reports what each step removed and reloads the roster", async () => {
      const { service, reload } = await build(HISTORY);

      expect(await service.purgeAccount("twix", "twix")).toEqual({
        slug: "twix",
        summoners: 1,
        matches: 1153,
        rankSnapshots: 300,
        detailCacheRows: 1152,
        timelineCacheRows: 600,
      });
      expect(reload).toHaveBeenCalledOnce();
    });

    it("removes the roster row of an account that never synced", async () => {
      const { service, prisma } = await build({ lol: ROSTER, puuids: [] });

      expect(await service.purgeAccount("twix", "twix")).toMatchObject({
        summoners: 0,
        matches: 0,
      });
      expect(prisma.lolAccount.delete).toHaveBeenCalledWith({
        where: { slug: "twix" },
      });
    });

    it("purges by the stored slug, not the casing the caller used", async () => {
      const { service, prisma } = await build(HISTORY);
      await service.purgeAccount("TWIX", "twix");
      expect(prisma.lolAccount.delete).toHaveBeenCalledWith({
        where: { slug: "twix" },
      });
    });
  });
});
