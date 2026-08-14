import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  type LolAccount,
  type LolAccountWithSummary,
  assertAccountOwnerInvariants,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

interface AccountsCache {
  lol: LolAccount[];
  steam: string[];
}

@Injectable()
export class IdentityService implements OnModuleInit {
  private readonly logger = new Logger(IdentityService.name);
  private cache: AccountsCache = { lol: [], steam: [] };

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  /**
   * Repopulates the roster cache from the DB. Every read on this service is
   * synchronous against that cache — the whitelist check sits in the hot
   * path of `resolveSummoner` and can't afford a query per call — so any
   * write to `LolAccount`/`SteamAccount` has to call this after committing
   * or the API keeps serving the pre-write roster until the next boot.
   *
   * Rows are ordered by `createdAt`, which is what gives `/me` (and so the
   * nav) a stable roster order.
   */
  async reload(): Promise<void> {
    const [lol, steam] = await Promise.all([
      this.prisma.lolAccount.findMany({ orderBy: { createdAt: "asc" } }),
      this.prisma.steamAccount.findMany({ orderBy: { createdAt: "asc" } }),
    ]);
    // Projected field-by-field rather than spread: `createdAt`/`updatedAt`
    // are roster bookkeeping and must not leak into the `/me` payload.
    this.cache = {
      lol: lol.map((a) => ({
        slug: a.slug,
        gameName: a.gameName,
        tagLine: a.tagLine,
        region: a.region,
        isOwner: a.isOwner,
        isPrimary: a.isPrimary,
      })),
      steam: steam.map((s) => s.steamId64),
    };
    try {
      this.assertRosterInvariants(this.cache.lol);
    } catch (err) {
      // Loud but non-fatal. A roster that breaks these invariants produces a
      // silently empty recap or a wrong "main account" subject, which is
      // near-impossible to trace back from the symptom — but refusing to boot
      // over it would take the whole API down for a bad flag on one row.
      this.logger.warn(
        `roster invariant violated: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    this.logger.log(`roster loaded — ${this.cache.lol.length} LoL account(s)`);
  }

  /**
   * Write-side guard: called with the roster a mutation is about to produce,
   * before it commits. This is the only place a bad roster is rejected —
   * `reload()` merely warns.
   *
   * The check that genuinely has to live here is "at least one primary
   * whenever an owner account exists": it is a cross-row existence assertion,
   * and Postgres has no constraint shape for it. Its two neighbours could be
   * pushed into the schema — a partial unique index for at-most-one primary,
   * a CHECK for primary-implies-owner — and are kept here anyway so a bad
   * write reports every violation at once instead of whichever the DB happens
   * to reject first. Slug uniqueness has no choice either way: the `slug`
   * primary key is case-sensitive while `findBySlug` is not, so `Ahri` and
   * `ahri` are two legal rows that resolve to whichever the roster lists first.
   */
  assertRosterInvariants(next: LolAccount[]): void {
    this.assertUniqueSlugs(next);
    assertAccountOwnerInvariants(next);
  }

  private assertUniqueSlugs(accounts: LolAccount[]): void {
    const seen = new Map<string, LolAccount>();
    for (const account of accounts) {
      const key = account.slug.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        throw new Error(
          `Duplicate slug "${account.slug}" — both ${existing.gameName}#${existing.tagLine} and ${account.gameName}#${account.tagLine} use it. Slugs must be unique.`
        );
      }
      seen.set(key, account);
    }
  }

  getLolAccounts(): LolAccount[] {
    return this.cache.lol;
  }

  // Hydrate the whitelist with the Summoner denorm snapshot in a single
  // query. The `puuid` join key is unstable across regions (Riot puuids
  // are globally unique but the API stores Summoner rows keyed on the
  // composite `gameName + tagLine + region`), so we look up by that
  // tuple. Accounts with no Summoner row yet (never resolved → no rank
  // history, no matches) get `summary: null`. Accounts with a row but no
  // refresh tick yet get `summary.updatedAt: null` — the UI uses that
  // signal to render the simple Riot-ID row instead of an empty rich
  // row.
  async getLolAccountsWithSummary(): Promise<LolAccountWithSummary[]> {
    const accounts = this.cache.lol;
    if (accounts.length === 0) return [];
    const summoners = await this.prisma.summoner.findMany({
      where: {
        OR: accounts.map((a) => ({
          gameName: a.gameName,
          tagLine: a.tagLine,
          region: a.region,
        })),
      },
      select: {
        gameName: true,
        tagLine: true,
        region: true,
        profileIconId: true,
        currentRankTier: true,
        currentRankDivision: true,
        currentRankLp: true,
        currentRankQueue: true,
        lastPlayedChampionAlias: true,
        summaryUpdatedAt: true,
      },
    });
    const summoners_by_id = new Map<string, (typeof summoners)[number]>();
    for (const s of summoners) {
      summoners_by_id.set(`${s.gameName}|${s.tagLine}|${s.region}`, s);
    }
    return accounts.map((account) => {
      const s = summoners_by_id.get(
        `${account.gameName}|${account.tagLine}|${account.region}`
      );
      if (!s) return { ...account, profileIconId: null, summary: null };
      const rank =
        s.currentRankTier && s.currentRankDivision && s.currentRankQueue
          ? {
              tier: s.currentRankTier,
              division: s.currentRankDivision,
              leaguePoints: s.currentRankLp ?? 0,
              queueId: s.currentRankQueue,
            }
          : null;
      return {
        ...account,
        profileIconId: s.profileIconId,
        summary: {
          rank,
          lastPlayedChampionAlias: s.lastPlayedChampionAlias,
          updatedAt: s.summaryUpdatedAt?.toISOString() ?? null,
        },
      };
    });
  }

  getSteamIds(): string[] {
    return this.cache.steam;
  }

  /**
   * PUUIDs of LoL accounts flagged `isOwner` in the roster, resolved via the
   * `Summoner` denorm. Used by self-portrait surfaces (the `/` conclusion
   * bands: rhythm, lifetime totals) to filter LoL aggregations to the
   * owner's own play history rather than every tracked account. Other
   * surfaces — recap, match list, champion stats — intentionally do NOT use
   * this filter; they remain broad so non-owner accounts in the roster
   * (friends, pros) still surface their own pages and chapters.
   *
   * Returns `[]` when no owner accounts are configured, or when none of
   * the configured owner accounts have resolved a `Summoner` row yet
   * (matches will then resolve to no rows under `puuid: { in: [] }`,
   * which is the correct degraded state — empty until the resolver
   * catches up).
   */
  async getOwnerPuuids(): Promise<string[]> {
    const ownerAccounts = this.cache.lol.filter((a) => a.isOwner);
    if (ownerAccounts.length === 0) return [];
    const summoners = await this.prisma.summoner.findMany({
      where: {
        OR: ownerAccounts.map((a) => ({
          gameName: { equals: a.gameName, mode: "insensitive" as const },
          tagLine: { equals: a.tagLine, mode: "insensitive" as const },
          region: { equals: a.region, mode: "insensitive" as const },
        })),
      },
      select: { puuid: true },
    });
    return summoners.map((s) => s.puuid);
  }

  findBySlug(slug: string): LolAccount | undefined {
    return this.cache.lol.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
  }

  isLolAccountAllowed(gameName: string, tagLine: string, region: string): boolean {
    return this.cache.lol.some(
      (a) =>
        a.gameName.toLowerCase() === gameName.toLowerCase() &&
        a.tagLine.toLowerCase() === tagLine.toLowerCase() &&
        a.region.toLowerCase() === region.toLowerCase()
    );
  }
}
