import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { ChampionLanePhase, LolAccount } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchLanePhase(
  account: LolAccount,
  championKey: string,
  count: number
): Promise<ChampionLanePhase> {
  const url = new URL(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/champions/${encodeURIComponent(championKey)}/lane-phase`
  );
  url.searchParams.set("count", String(count));

  const res = await fetch(url);
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
  return res.json() as Promise<ChampionLanePhase>;
}

export function useChampionLanePhase(
  account: LolAccount | undefined,
  championKey: string,
  count = 200
) {
  return useQuery({
    queryKey: [
      "lol",
      "champion-lane-phase",
      account?.region,
      account?.gameName,
      account?.tagLine,
      championKey,
      count,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchLanePhase(account, championKey, count);
    },
    enabled: account !== undefined && championKey.length > 0,
  });
}
