import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  AdminLolAccount,
  AdminLolAccountDeleteResult,
  AdminSteamAccount,
  AdminSteamAccountDeleteResult,
  LolAccount,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { platformToRegional } from "../riot/regions";
import { RiotError } from "../riot/riot.error";
import { RiotService } from "../riot/riot.service";
import type {
  CreateLolAccountDto,
  CreateSteamAccountDto,
  UpdateLolAccountDto,
} from "./admin-accounts.dto";

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

interface SteamAccountRow {
  steamId64: string;
  isOwner: boolean;
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

function toAdminSteamAccount(row: SteamAccountRow): AdminSteamAccount {
  return {
    steamId64: row.steamId64,
    isOwner: row.isOwner,
    createdAt: row.createdAt.toISOString(),
  };
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

  async listSteamAccounts(): Promise<AdminSteamAccount[]> {
    const rows = await this.prisma.steamAccount.findMany({
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toAdminSteamAccount);
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

  async createSteamAccount(dto: CreateSteamAccountDto): Promise<AdminSteamAccount> {
    if (this.identity.getSteamIds().includes(dto.steamId64)) {
      throw new ConflictException(`${dto.steamId64} is already tracked.`);
    }
    const row = await this.prisma.steamAccount.create({
      data: { steamId64: dto.steamId64, isOwner: dto.isOwner ?? true },
    });
    await this.identity.reload();
    return toAdminSteamAccount(row);
  }

  async deleteSteamAccount(steamId64: string): Promise<AdminSteamAccountDeleteResult> {
    if (!this.identity.getSteamIds().includes(steamId64)) {
      throw new NotFoundException(`No Steam account tracked with id ${steamId64}.`);
    }
    await this.prisma.steamAccount.delete({ where: { steamId64 } });
    await this.identity.reload();
    return { steamId64 };
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
   * How many `Match` rows the account's history holds. There is no foreign key
   * to follow: the roster's Riot-ID tuple resolves to a `Summoner.puuid` in
   * application code, and matches are keyed on that puuid.
   *
   * Matched case-insensitively, like `getOwnerPuuids` does. `resolveSummoner`
   * writes `Summoner` rows using Riot's canonical casing rather than the
   * roster's, so accounts added before this module existed can legitimately
   * differ in case from their own history rows.
   */
  private async countMatchRows(account: LolAccount): Promise<number> {
    const summoners = await this.prisma.summoner.findMany({
      where: {
        gameName: { equals: account.gameName, mode: "insensitive" },
        tagLine: { equals: account.tagLine, mode: "insensitive" },
        region: { equals: account.region, mode: "insensitive" },
      },
      select: { puuid: true },
    });
    if (summoners.length === 0) return 0;
    return this.prisma.match.count({
      where: { puuid: { in: summoners.map((s) => s.puuid) } },
    });
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
