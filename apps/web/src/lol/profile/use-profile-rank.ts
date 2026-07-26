import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { LolAccount, SummonerProfile } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchSummonerProfile(account: LolAccount): Promise<SummonerProfile> {
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/rank`
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<SummonerProfile>;
}

/**
 * Shared by `useProfileRank` and the profile route's loader, so both build the
 * same cache key. A loader that constructs the key inline warms an entry the
 * component never reads, and the failure is silent in the worst way: the data
 * lands in the dehydrated payload, so the page looks primed while the component
 * still renders its pending branch.
 */
export function profileRankQueryOptions(account: LolAccount | undefined) {
  return queryOptions({
    queryKey: [
      "lol",
      "rank",
      account?.region,
      account?.gameName,
      account?.tagLine,
    ] as const,
    queryFn: (): Promise<SummonerProfile> => {
      if (!account) throw new Error("No account");
      return fetchSummonerProfile(account);
    },
    enabled: account !== undefined,
  });
}

export function useProfileRank(account: LolAccount | undefined) {
  return useQuery(profileRankQueryOptions(account));
}
