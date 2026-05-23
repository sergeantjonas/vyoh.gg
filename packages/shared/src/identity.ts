import type { LolAccountWithSummary } from "./lol/account.ts";

export interface Me {
  lol: LolAccountWithSummary[];
  steam: string[];
}
