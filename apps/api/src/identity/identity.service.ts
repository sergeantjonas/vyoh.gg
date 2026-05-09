import { readFileSync, watch } from "node:fs";
import { join } from "node:path";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { LolAccount } from "@vyoh/shared";

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

  constructor(@Inject(ACCOUNTS_CONFIG) private config: AccountsConfig) {
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
