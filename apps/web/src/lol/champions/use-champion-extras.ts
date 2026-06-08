import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useSeriousQueues } from "@/lol/_shared/serious-queues/serious-queues";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ChampionExtras, LolAccount } from "@vyoh/shared";
import { useMemo } from "react";

const API_URL = "http://localhost:2010";

export function championExtrasQueryOptions(
  account: LolAccount | undefined,
  championKey: string,
  queueIds: readonly number[]
) {
  return queryOptions<ChampionExtras>({
    queryKey: [
      "lol",
      "champion-extras",
      account?.region,
      account?.gameName,
      account?.tagLine,
      championKey,
      queueIds,
    ],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const url = new URL(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/champions/${encodeURIComponent(championKey)}/stats`
      );
      if (queueIds.length > 0) {
        url.searchParams.set("queues", queueIds.join(","));
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ChampionExtras>;
    },
    enabled: !!account,
    staleTime: 5 * 60_000,
  });
}

export function useChampionExtras(accountSlug: string, championKey: string) {
  const account = useAccountFromSlug(accountSlug);
  const { ids } = useSeriousQueues();
  const queueIds = useMemo(() => [...ids].sort((a, b) => a - b), [ids]);
  return useQuery(championExtrasQueryOptions(account, championKey, queueIds));
}
