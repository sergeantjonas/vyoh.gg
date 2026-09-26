import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ChampionMasteryList, LolAccount } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";

// Not primed by the landing loader: a cold account costs the api a Riot call,
// and that round trip would sit inside the server render for a below-the-fold card.
export function championMasteryListQueryOptions(account: LolAccount | undefined) {
  return queryOptions<ChampionMasteryList>({
    queryKey: [
      "lol",
      "champion-mastery-list",
      account?.region,
      account?.gameName,
      account?.tagLine,
    ],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const res = await fetch(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/mastery`
      );
      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
      return res.json() as Promise<ChampionMasteryList>;
    },
    enabled: !!account,
    // The api holds Riot's answer for fifteen minutes; refetching sooner would
    // only read the same one back.
    staleTime: 15 * 60_000,
    // Each retry is a fresh Riot call, since the api drops a failed answer.
    retry: 1,
  });
}

export function useChampionMasteryList(accountSlug: string) {
  return useQuery(championMasteryListQueryOptions(useAccountFromSlug(accountSlug)));
}
