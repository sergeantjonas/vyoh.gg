import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AdminLolAccount,
  AdminLolAccountDeleteResult,
  AdminPurgeCounts,
  AdminPurgePreview,
  AdminPurgeResult,
  LolAccount,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { platformToRegional } from "../riot/regions";
import { RiotError } from "../riot/riot.error";
import { RiotService } from "../riot/riot.service";
import type { CreateLolAccountDto, UpdateLolAccountDto } from "./admin-accounts.dto";

interface LolAccountRow {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
  isOwner: boolean;
  isPrimary: boolean;
  hiddenAt: Date | null;
  syncPausedAt: Date | null;
  createdAt: Date;
}

function toAdminLolAccount(row: LolAccountRow): AdminLolAccount {
  return {
    slug: row.slug,
    gameName: row.gameName,
    tagLine: row.tagLine,
    region: row.region,
    isOwner: row.isOwner,
    isPrimary: row.isPrimary,
    hiddenAt: row.hiddenAt?.toISOString() ?? null,
    syncPausedAt: row.syncPausedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

interface PurgePreviewRow {
  matches: number;
  rankSnapshots: number;
  detailCacheRows: number;
  timelineCacheRows: number;
  matchAvgBytes: number;
  rankSnapshotAvgBytes: number;
  detailAvgBytes: number;
  timelineAvgBytes: number;
}

/**
 * The purge's target puuids as a one-column relation, so the preview query can
 * reference them from four subqueries without repeating the list.
 *
 * An account with no synced history has none, and `unnest(ARRAY[]::text[])`
 * cannot be written through a parameter list that is empty — hence the
 * degenerate branch, which produces the same shape and no rows.
 */
function puuidSet(puuids: string[]): Prisma.Sql {
  if (puuids.length === 0) return Prisma.sql`SELECT NULL::text AS puuid WHERE false`;
  return Prisma.sql`SELECT unnest(ARRAY[${Prisma.join(puuids)}]::text[]) AS puuid`;
}

/**
 * Bytes per row, per table, from the relation sizes Postgres already tracks.
 * `pg_total_relation_size` is the right one of the family here: it counts
 * indexes and TOAST, and for `MatchTimelineCache` the TOAST *is* the data.
 *
 * Table names are literals rather than parameters because a `FROM` clause
 * cannot be parameterised, and keeping them literal keeps `Prisma.raw` — and
 * the injection surface it opens — out of this file entirely.
 */
const AVG_ROW_BYTES = Prisma.sql`
  COALESCE(pg_total_relation_size('"Match"')::float8
    / NULLIF((SELECT count(*) FROM "Match"), 0), 0) AS "matchAvgBytes",
  COALESCE(pg_total_relation_size('"RankSnapshot"')::float8
    / NULLIF((SELECT count(*) FROM "RankSnapshot"), 0), 0) AS "rankSnapshotAvgBytes",
  COALESCE(pg_total_relation_size('"MatchDetailCache"')::float8
    / NULLIF((SELECT count(*) FROM "MatchDetailCache"), 0), 0) AS "detailAvgBytes",
  COALESCE(pg_total_relation_size('"MatchTimelineCache"')::float8
    / NULLIF((SELECT count(*) FROM "MatchTimelineCache"), 0), 0) AS "timelineAvgBytes"
`;

/**
 * Set-or-clear, idempotent in both directions. Re-sending `hidden: true` keeps
 * the original timestamp rather than restamping it: "hidden since when" is the
 * question the column exists to answer, and a double-clicked toggle that reset
 * the answer to now would quietly destroy it.
 */
function stampFlag(next: boolean, current: Date | null, now: Date): Date | null {
  if (!next) return null;
  return current ?? now;
}

/**
 * Roster CRUD. Every mutation here follows the same three beats: build the
 * roster the write would produce, assert the domain invariants against *that*
 * rather than against what is currently loaded, then write and `reload()`.
 *
 * The reload is not optional bookkeeping, and it is the reason every mutation
 * routes through here rather than writing the tables directly. Every read on
 * `IdentityService` is synchronous against a boot-populated cache — the sync
 * whitelist sits in the hot path of `resolveSummoner` and can't afford a query
 * per call — so a commit without a reload leaves the api serving the pre-write
 * roster until it restarts.
 */
@Injectable()
export class AdminAccountsService {
  private readonly logger = new Logger(AdminAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly riot: RiotService
  ) {}

  // Reads go to the DB rather than the identity cache: the cache holds the
  // public projection, and the two timestamps this table exists to show are
  // exactly what that projection drops.
  async listLolAccounts(): Promise<AdminLolAccount[]> {
    const rows = await this.prisma.lolAccount.findMany({
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toAdminLolAccount);
  }

  async createLolAccount(dto: CreateLolAccountDto): Promise<AdminLolAccount> {
    if (this.identity.findBySlug(dto.slug)) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken.`);
    }
    // Checked here rather than left to the `@@unique([gameName, tagLine,
    // region])` constraint, because the constraint is case-sensitive and the
    // whitelist check is not: `Ahri#EUW` and `ahri#euw` would both insert and
    // then split one account's history across two half-synced pages.
    if (this.identity.isLolAccountAllowed(dto.gameName, dto.tagLine, dto.region)) {
      throw new ConflictException(
        `${dto.gameName}#${dto.tagLine} is already tracked on ${dto.region}.`
      );
    }

    const riotId = await this.resolveRiotId(dto.gameName, dto.tagLine, dto.region);
    // Riot's canonical casing wins over what was typed into the form. The
    // resolver writes `Summoner` rows from this same endpoint, so storing
    // anything else leaves the roster tuple and the history tuple disagreeing
    // on case for the lifetime of the account.
    const created: LolAccount = {
      slug: dto.slug,
      gameName: riotId.gameName,
      tagLine: riotId.tagLine,
      region: dto.region,
      isOwner: dto.isOwner === true,
      isPrimary: dto.isPrimary === true,
    };

    const roster = this.identity.getLolAccounts();
    this.assertProposedRoster([...this.demoteIncumbent(roster, created), created]);

    const row = await this.prisma.$transaction(async (tx) => {
      if (created.isPrimary === true) {
        await tx.lolAccount.updateMany({
          where: { isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.lolAccount.create({
        data: {
          slug: created.slug,
          gameName: created.gameName,
          tagLine: created.tagLine,
          region: created.region,
          isOwner: created.isOwner === true,
          isPrimary: created.isPrimary === true,
        },
      });
    });
    await this.identity.reload();
    this.logger.log(
      `roster + ${created.slug} (${created.gameName}#${created.tagLine} on ${created.region})`
    );
    return toAdminLolAccount(row);
  }

  async updateLolAccount(
    slug: string,
    dto: UpdateLolAccountDto
  ): Promise<AdminLolAccount> {
    const current = this.requireAccount(slug);
    if (
      dto.isOwner === undefined &&
      dto.isPrimary === undefined &&
      dto.hidden === undefined &&
      dto.syncPaused === undefined
    ) {
      throw new BadRequestException("No fields to update.");
    }

    const proposed: LolAccount = {
      ...current,
      isOwner: dto.isOwner ?? current.isOwner === true,
      isPrimary: dto.isPrimary ?? current.isPrimary === true,
      hidden: dto.hidden ?? current.hidden === true,
    };
    const roster = this.identity
      .getLolAccounts()
      .map((a) => (a.slug === current.slug ? proposed : a));
    this.assertProposedRoster(this.demoteIncumbent(roster, proposed));

    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      // Read inside the transaction rather than deriving from the roster cache:
      // `syncPausedAt` has no counterpart in the public projection at all, so
      // the cache cannot answer "was it already paused" — and the flags have to
      // behave symmetrically.
      const existing = await tx.lolAccount.findUniqueOrThrow({
        where: { slug: current.slug },
      });
      if (dto.isPrimary === true) {
        await tx.lolAccount.updateMany({
          where: { isPrimary: true, slug: { not: current.slug } },
          data: { isPrimary: false },
        });
      }
      return tx.lolAccount.update({
        where: { slug: current.slug },
        data: {
          ...(dto.isOwner === undefined ? {} : { isOwner: dto.isOwner }),
          ...(dto.isPrimary === undefined ? {} : { isPrimary: dto.isPrimary }),
          ...(dto.hidden === undefined
            ? {}
            : { hiddenAt: stampFlag(dto.hidden, existing.hiddenAt, now) }),
          ...(dto.syncPaused === undefined
            ? {}
            : { syncPausedAt: stampFlag(dto.syncPaused, existing.syncPausedAt, now) }),
        },
      });
    });
    await this.identity.reload();
    return toAdminLolAccount(row);
  }

  async deleteLolAccount(
    slug: string,
    force: boolean
  ): Promise<AdminLolAccountDeleteResult> {
    const current = this.requireAccount(slug);
    this.assertProposedRoster(
      this.identity.getLolAccounts().filter((a) => a.slug !== current.slug)
    );

    const matchRows = await this.countMatchRows(current);
    if (matchRows > 0 && !force) {
      throw new ConflictException(
        `"${current.slug}" still has ${matchRows} match row(s). Removing the roster row strands them — the Riot ID is the only handle on that history. Hide the account to drop it from the nav, pause it to stop syncing, or re-send with ?force=true to remove the row anyway.`
      );
    }

    // `current.slug`, not the requested one: `findBySlug` resolves
    // case-insensitively while the primary key is case-sensitive, so deleting
    // by what the caller typed can miss the row it just validated.
    await this.prisma.lolAccount.delete({ where: { slug: current.slug } });
    await this.identity.reload();
    this.logger.log(`roster - ${current.slug} (${matchRows} match row(s) left in place)`);
    return { slug: current.slug, matchRows };
  }

  /**
   * What a purge would remove, so the dialog can show it before the operator
   * commits. Read-only, and deliberately computed with the same anti-join the
   * sweep uses rather than an approximation of it: a preview that counts every
   * cache row for every match would overstate the shared ones, and the whole
   * point of the number is that it is trustworthy.
   */
  async purgePreview(slug: string): Promise<AdminPurgePreview> {
    const current = this.requireAccount(slug);
    const puuids = await this.resolvePuuids(current);

    // A tuple, not an array: the final SELECT has no FROM, so it returns
    // exactly one row and the destructure below cannot come up empty.
    const [row] = await this.prisma.$queryRaw<[PurgePreviewRow]>`
      WITH target AS (${puuidSet(puuids)}),
      mine AS (
        SELECT DISTINCT "matchId" FROM "Match" WHERE puuid IN (SELECT puuid FROM target)
      ),
      orphan AS (
        SELECT m."matchId" FROM mine m
        WHERE NOT EXISTS (
          SELECT 1 FROM "Match" o
          WHERE o."matchId" = m."matchId"
            AND o.puuid NOT IN (SELECT puuid FROM target)
        )
      )
      SELECT
        (SELECT count(*) FROM "Match"
          WHERE puuid IN (SELECT puuid FROM target))::int AS matches,
        (SELECT count(*) FROM "RankSnapshot"
          WHERE puuid IN (SELECT puuid FROM target))::int AS "rankSnapshots",
        (SELECT count(*) FROM "MatchDetailCache"
          WHERE "matchId" IN (SELECT "matchId" FROM orphan))::int AS "detailCacheRows",
        (SELECT count(*) FROM "MatchTimelineCache"
          WHERE "matchId" IN (SELECT "matchId" FROM orphan))::int AS "timelineCacheRows",
        ${AVG_ROW_BYTES}
    `;

    return {
      slug: current.slug,
      gameName: current.gameName,
      tagLine: current.tagLine,
      region: current.region,
      summoners: puuids.length,
      matches: row.matches,
      rankSnapshots: row.rankSnapshots,
      detailCacheRows: row.detailCacheRows,
      timelineCacheRows: row.timelineCacheRows,
      estimatedBytes: Math.round(
        row.matches * row.matchAvgBytes +
          row.rankSnapshots * row.rankSnapshotAvgBytes +
          row.detailCacheRows * row.detailAvgBytes +
          row.timelineCacheRows * row.timelineAvgBytes
      ),
    };
  }

  /**
   * Removes the roster row *and* the history behind it. Irreversible, and the
   * only route in the api that is.
   *
   * The delete order is not a preference — `Match.summoner` and
   * `RankSnapshot.summoner` are required relations with no `onDelete`, so
   * Prisma's default `Restrict` makes Postgres refuse a `Summoner` that still
   * has either. Verified against dev rather than assumed: reversing the first
   * two steps raises `Match_puuid_fkey`.
   *
   * The cache sweep is why the shared-match case needs no special handling. Framing
   * cache eviction as "delete rows no `Match` references any more", run *after*
   * the match delete, keeps a game two roster accounts both played — the other
   * account's row still points at it — and incidentally re-collects anything
   * earlier deletes stranded. Rehearsed against dev in a rolled-back
   * transaction: purging a 1,973-match account swept 1,972 detail rows, and the
   * one it left is the single `matchId` two roster accounts share.
   */
  async purgeAccount(slug: string, confirm: string): Promise<AdminPurgeResult> {
    const current = this.requireAccount(slug);
    if (confirm !== current.slug) {
      throw new BadRequestException(
        `Purge confirmation "${confirm}" does not match "${current.slug}".`
      );
    }
    this.assertProposedRoster(
      this.identity.getLolAccounts().filter((a) => a.slug !== current.slug)
    );

    const puuids = await this.resolvePuuids(current);

    const counts = await this.prisma.$transaction(
      async (tx): Promise<AdminPurgeCounts> => {
        const matches = await tx.match.deleteMany({ where: { puuid: { in: puuids } } });
        const rankSnapshots = await tx.rankSnapshot.deleteMany({
          where: { puuid: { in: puuids } },
        });
        const summoners = await tx.summoner.deleteMany({
          where: { puuid: { in: puuids } },
        });
        const detailCacheRows = await tx.$executeRaw`
          DELETE FROM "MatchDetailCache"
          WHERE "matchId" NOT IN (SELECT "matchId" FROM "Match")
        `;
        const timelineCacheRows = await tx.$executeRaw`
          DELETE FROM "MatchTimelineCache"
          WHERE "matchId" NOT IN (SELECT "matchId" FROM "Match")
        `;
        await tx.lolAccount.delete({ where: { slug: current.slug } });

        return {
          summoners: summoners.count,
          matches: matches.count,
          rankSnapshots: rankSnapshots.count,
          detailCacheRows,
          timelineCacheRows,
        };
      },
      // Well past what this needs, and deliberately so. Dev's largest account
      // — 1,973 matches, ~163 MB — runs the whole sequence in 1.2s, the
      // timeline sweep taking 996ms of it. But Prisma's default is 5s, the
      // margin above a measurement taken on one dataset is not a guarantee, and
      // `PrismaService` already caps each individual statement at 10s via the
      // pool's `statement_timeout`. That is the limit that should stop a
      // pathological purge; this one exists only so the interactive-transaction
      // default cannot roll back a purge the operator already confirmed.
      { timeout: 120_000, maxWait: 15_000 }
    );

    await this.identity.reload();
    this.logger.log(
      `purge - ${current.slug} (${puuids.join(", ") || "no summoner"}): ` +
        `${counts.matches} match, ${counts.rankSnapshots} snapshot, ` +
        `${counts.summoners} summoner, ${counts.detailCacheRows} detail-cache, ` +
        `${counts.timelineCacheRows} timeline-cache row(s)`
    );
    return { slug: current.slug, ...counts };
  }

  private requireAccount(slug: string): LolAccount {
    const account = this.identity.findBySlug(slug);
    if (!account) throw new NotFoundException(`No account with slug "${slug}".`);
    return account;
  }

  /**
   * Promotion is a paired write. The roster allows exactly one primary, so
   * setting `isPrimary` on a row has to clear it from the incumbent in the same
   * transaction — as two requests it would pass through a two-primary state,
   * which `assertRosterInvariants` rejects, so the intermediate write fails
   * rather than briefly misbehaving.
   *
   * A no-op unless the row actually claims primary. Demoting on every write
   * would leave a roster with owners and no primary — which the invariants
   * reject, so an ordinary create would 400 on a rule it never touched.
   */
  private demoteIncumbent(roster: LolAccount[], promoted: LolAccount): LolAccount[] {
    if (promoted.isPrimary !== true) return roster;
    return roster.map((a) =>
      a.slug !== promoted.slug && a.isPrimary === true ? { ...a, isPrimary: false } : a
    );
  }

  // Invariant breaches are the caller's fault — a request to hide the primary or
  // to unflag the only one — so they surface as 400s rather than propagating as
  // the raw `Error` the shared asserts throw, which the default filter would
  // report as a 500.
  private assertProposedRoster(next: LolAccount[]): void {
    try {
      this.identity.assertRosterInvariants(next);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * The `Summoner.puuid`s a roster row's history hangs off. There is no foreign
   * key to follow: the roster's Riot-ID tuple resolves to a puuid in
   * application code, and every history table is keyed on that puuid.
   *
   * Matched case-insensitively, like `getOwnerPuuids` does. `resolveSummoner`
   * writes `Summoner` rows using Riot's canonical casing rather than the
   * roster's, so accounts added before this module existed can legitimately
   * differ in case from their own history rows.
   *
   * Normally one, and not guaranteed to be: the `@@unique` is on the tuple, so
   * a Riot ID that changed hands, or a row written before a rename, leaves a
   * second `Summoner` under the same name. Purge has to take all of them or it
   * would leave history behind that no roster row can reach.
   */
  private async resolvePuuids(account: LolAccount): Promise<string[]> {
    const summoners = await this.prisma.summoner.findMany({
      where: {
        gameName: { equals: account.gameName, mode: "insensitive" },
        tagLine: { equals: account.tagLine, mode: "insensitive" },
        region: { equals: account.region, mode: "insensitive" },
      },
      select: { puuid: true },
    });
    return summoners.map((s) => s.puuid);
  }

  private async countMatchRows(account: LolAccount): Promise<number> {
    const puuids = await this.resolvePuuids(account);
    if (puuids.length === 0) return 0;
    return this.prisma.match.count({ where: { puuid: { in: puuids } } });
  }

  /**
   * Confirms the Riot ID exists before a row is written for it, and returns the
   * canonical spelling.
   *
   * A 404 is a typo in the form, not a missing endpoint, so it is re-thrown as a
   * 400 the client can render against the Riot-ID fields — a 404 on
   * `POST /admin/lol-accounts` reads as "that route doesn't exist". Every other
   * `RiotError` (429, 5xx, limiter timeout) falls through to
   * `RiotExceptionFilter`, which already maps it to a retry-shaped message, and
   * the row stays unwritten either way.
   */
  private async resolveRiotId(
    gameName: string,
    tagLine: string,
    region: string
  ): Promise<{ gameName: string; tagLine: string }> {
    try {
      const account = await this.riot.getAccountByRiotId(
        gameName,
        tagLine,
        platformToRegional(region)
      );
      return { gameName: account.gameName, tagLine: account.tagLine };
    } catch (err) {
      if (err instanceof RiotError && err.status === 404) {
        throw new BadRequestException(
          `No Riot account found for ${gameName}#${tagLine} on ${region}.`
        );
      }
      throw err;
    }
  }
}
