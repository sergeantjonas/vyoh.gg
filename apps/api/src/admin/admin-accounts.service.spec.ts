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
  } = {}
) {
  const lolRows = rows(seed.lol ?? []);
  const find = (slug: string) => lolRows.find((r) => r.slug === slug);

  const prisma = {
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
      delete: vi.fn().mockResolvedValue(undefined),
    },
    // Nothing in this service touches Steam — this is here because these tests
    // run against a real `IdentityService`, and every `reload()` reads both
    // tables to rebuild its cache.
    steamAccount: { findMany: vi.fn().mockResolvedValue([]) },
    summoner: {
      findMany: vi
        .fn()
        .mockResolvedValue((seed.puuids ?? []).map((puuid) => ({ puuid }))),
    },
    match: { count: vi.fn().mockResolvedValue(seed.matchRows ?? 0) },
    // The callback receives the same stub, so a write inside the transaction
    // lands on the same mocks the assertions read.
    $transaction: vi.fn(),
  };
  prisma.$transaction = vi.fn(
    async (fn: (tx: typeof prisma) => Promise<unknown>) => await fn(prisma)
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
});
