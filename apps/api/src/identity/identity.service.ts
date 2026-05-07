import { Inject, Injectable } from "@nestjs/common";
import type { LolAccount } from "@vyoh/shared";

export const ACCOUNTS_CONFIG = Symbol("ACCOUNTS_CONFIG");

export interface AccountsConfig {
  lol: LolAccount[];
  steam: string[];
}

@Injectable()
export class IdentityService {
  constructor(@Inject(ACCOUNTS_CONFIG) private readonly config: AccountsConfig) {
    this.assertUniqueSlugs();
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

  private assertUniqueSlugs(): void {
    const seen = new Map<string, LolAccount>();
    for (const account of this.config.lol) {
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
