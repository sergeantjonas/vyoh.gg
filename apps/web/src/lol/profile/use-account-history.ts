import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { AccountHistory, LolAccount } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";

// Not primed by the landing loader: a few hundred bytes, but the chips sit far
// below the fold, where arriving after hydration moves nothing the visitor sees.
export function accountHistoryQueryOptions(account: LolAccount | undefined) {
  return queryOptions<AccountHistory>({
    queryKey: [
      "lol",
      "account-history",
      account?.region,
      account?.gameName,
      account?.tagLine,
    ],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const res = await fetch(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/history`
      );
      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
      return res.json() as Promise<AccountHistory>;
    },
    enabled: !!account,
    staleTime: 60 * 60_000,
  });
}

export function useAccountHistory(accountSlug: string) {
  return useQuery(accountHistoryQueryOptions(useAccountFromSlug(accountSlug)));
}
