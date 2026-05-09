import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useQuery } from "@tanstack/react-query";
import type { ChampionExtras } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

export function useChampionExtras(accountSlug: string, championKey: string) {
  const account = useAccountFromSlug(accountSlug);

  return useQuery<ChampionExtras>({
    queryKey: ["champion-extras", accountSlug, championKey],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const res = await fetch(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/champions/${encodeURIComponent(championKey)}/stats`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ChampionExtras>;
    },
    enabled: !!account,
    staleTime: 5 * 60_000,
  });
}
