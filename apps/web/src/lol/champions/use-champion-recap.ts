import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ChampionRecap, LolAccount } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

/**
 * Tanstack-Query options for the per-champion landing-chapter recap. The
 * recap is a single small aggregate over up to a year of stored matches on
 * this champion (window enforced server-side), so the hook caches relatively
 * aggressively — the underlying data only moves when a new match is ingested.
 */
export function championRecapQueryOptions(
  account: LolAccount | undefined,
  championKey: string
) {
  return queryOptions<ChampionRecap>({
    queryKey: [
      "lol",
      "champion-recap",
      account?.region,
      account?.gameName,
      account?.tagLine,
      championKey,
    ],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const url = new URL(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/champions/${encodeURIComponent(championKey)}/recap`
      );
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ChampionRecap>;
    },
    enabled: !!account,
    // Recap is heavier than a typical query — aggregate over many matches.
    // 5min keeps the chapter snappy across same-session navs.
    staleTime: 5 * 60_000,
  });
}

/**
 * Account-direct form. Subject chapters mounted on `/` already hold a
 * resolved LolAccount, so they skip the slug-resolve roundtrip.
 */
export function useChampionRecap(account: LolAccount | undefined, championKey: string) {
  return useQuery(championRecapQueryOptions(account, championKey));
}

/**
 * Slug-keyed form, mirrors `useChampionExtras`. For surfaces that only have
 * the route slug (deep-stats panels, future per-champion routes).
 */
export function useChampionRecapBySlug(accountSlug: string, championKey: string) {
  const account = useAccountFromSlug(accountSlug);
  return useQuery(championRecapQueryOptions(account, championKey));
}
