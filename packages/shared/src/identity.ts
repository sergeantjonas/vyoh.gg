import type { LolAccount } from "./lol/account.ts";

export interface Me {
  lol: LolAccount[];
  steam: string[];
}
