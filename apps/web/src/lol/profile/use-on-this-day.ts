import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { LolAccount, OnThisDay } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";

// Not primed by the landing loader: the answer is well under 1 kB, but the card
// renders nothing on about half the days of the year and sits far below the fold.
export function onThisDayQueryOptions(account: LolAccount | undefined) {
  return queryOptions<OnThisDay>({
    queryKey: [
      "lol",
      "on-this-day",
      account?.region,
      account?.gameName,
      account?.tagLine,
    ],
    queryFn: async () => {
      if (!account) throw new Error("Account not found");
      const res = await fetch(
        `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/on-this-day`
      );
      if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
      return res.json() as Promise<OnThisDay>;
    },
    enabled: !!account,
    // The answer only changes at Brussels midnight, so a visit within the hour
    // reuses the last one. Focus refetch is off app-wide, so a tab left open
    // across midnight keeps its card until the page remounts.
    staleTime: 60 * 60_000,
  });
}

export function useOnThisDay(accountSlug: string) {
  return useQuery(onThisDayQueryOptions(useAccountFromSlug(accountSlug)));
}
