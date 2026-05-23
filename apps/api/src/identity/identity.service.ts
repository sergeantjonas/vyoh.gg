import { readFileSync, watch } from "node:fs";
import { join } from "node:path";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { LolAccount, LolAccountWithSummary } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

export const ACCOUNTS_CONFIG = Symbol("ACCOUNTS_CONFIG");

export interface AccountsConfig {
  lol: LolAccount[];
  steam: string[];
}

@Injectable()
export class IdentityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdentityService.name);
  private watcher: ReturnType<typeof watch> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(ACCOUNTS_CONFIG) private config: AccountsConfig,
    private readonly prisma: PrismaService
  ) {
    this.assertUniqueSlugs(this.config);
  }

  onModuleInit(): void {
    const path = join(process.cwd(), "accounts.json");
    this.watcher = watch(path, () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        try {
          const next: AccountsConfig = JSON.parse(readFileSync(path, "utf-8"));
          this.assertUniqueSlugs(next);
          this.config = next;
          this.logger.log(`accounts.json reloaded — ${next.lol.length} LoL account(s)`);
        } catch (err) {
          this.logger.warn(
            `accounts.json reload failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }, 100);
    });
  }

  onModuleDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.watcher?.close();
  }

  getLolAccounts(): LolAccount[] {
    return this.config.lol;
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
    const accounts = this.config.lol;
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
      if (!s) return { ...account, summary: null };
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
        summary: {
          rank,
          lastPlayedChampionAlias: s.lastPlayedChampionAlias,
          updatedAt: s.summaryUpdatedAt?.toISOString() ?? null,
        },
      };
    });
  }

  getSteamIds(): string[] {
    return this.config.steam;
  }

  findBySlug(slug: string): LolAccount | undefined {
    return this.config.lol.find((a) => a.slug.toLowerCase() === slug.toLowerCase());
  }

  isLolAccountAllowed(gameName: string, tagLine: string, region: string): boolean {
    return this.config.lol.some(
      (a) =>
        a.gameName.toLowerCase() === gameName.toLowerCase() &&
        a.tagLine.toLowerCase() === tagLine.toLowerCase() &&
        a.region.toLowerCase() === region.toLowerCase()
    );
  }

  private assertUniqueSlugs(config: AccountsConfig): void {
    const seen = new Map<string, LolAccount>();
    for (const account of config.lol) {
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
}
