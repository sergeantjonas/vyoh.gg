import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ChampionMasteryResponse, LolAccount } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";

// Deliberately not primed by the champion route's loader: the api answers a
// cold account by calling Riot, and that round trip would sit inside the
// server render for a secondary chip.
export function championMasteryQueryOptions(
  account: LolAccount | undefined,
  championKey: string
) {
  return queryOptions<ChampionMasteryResponse>({
    queryKey: [
      "lol",
      "champion-mastery",
      account?.region,
      account?.gameName,
      account?.tagLine,
      championKey,
    ],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const res = await fetch(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/champions/${encodeURIComponent(championKey)}/mastery`
      );
      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
      return res.json() as Promise<ChampionMasteryResponse>;
    },
    enabled: !!account,
    // The api holds Riot's answer for fifteen minutes; refetching sooner would
    // only read the same one back.
    staleTime: 15 * 60_000,
    // Each retry is a fresh Riot call, since the api drops a failed answer.
    retry: 1,
  });
}

export function useChampionMastery(accountSlug: string, championKey: string) {
  const account = useAccountFromSlug(accountSlug);
  return useQuery(championMasteryQueryOptions(account, championKey));
}
