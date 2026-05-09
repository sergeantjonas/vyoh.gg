import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useQuery } from "@tanstack/react-query";
import type { ChampionExtras } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

export function useChampionExtras(
  accountSlug: string,
  championKey: string,
  queue?: number
) {
  const account = useAccountFromSlug(accountSlug);

  return useQuery<ChampionExtras>({
    queryKey: [
      "lol",
      "champion-extras",
      account?.region,
      account?.gameName,
      account?.tagLine,
      championKey,
      queue,
    ],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const url = new URL(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/champions/${encodeURIComponent(championKey)}/stats`
      );
      if (queue !== undefined) url.searchParams.set("queue", String(queue));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ChampionExtras>;
    },
    enabled: !!account,
    staleTime: 5 * 60_000,
  });
}
