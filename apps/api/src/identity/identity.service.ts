import { Inject, Injectable } from "@nestjs/common";
import type { LolAccount } from "@vyoh/shared";

export const ACCOUNTS_CONFIG = Symbol("ACCOUNTS_CONFIG");

export interface AccountsConfig {
  lol: LolAccount[];
  steam: string[];
}

@Injectable()
export class IdentityService {
  constructor(@Inject(ACCOUNTS_CONFIG) private readonly config: AccountsConfig) {}

  getLolAccounts(): LolAccount[] {
    return this.config.lol;
  }

  getSteamIds(): string[] {
    return this.config.steam;
  }

  isLolAccountAllowed(gameName: string, tagLine: string, region: string): boolean {
    return this.config.lol.some(
      (a) =>
        a.gameName.toLowerCase() === gameName.toLowerCase() &&
        a.tagLine.toLowerCase() === tagLine.toLowerCase() &&
        a.region.toLowerCase() === region.toLowerCase()
    );
  }
}
