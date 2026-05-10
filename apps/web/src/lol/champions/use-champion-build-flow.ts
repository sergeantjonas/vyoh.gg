import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { ChampionBuildFlowEntry, LolAccount } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchBuildFlow(
  account: LolAccount,
  championKey: string,
  count: number
): Promise<ChampionBuildFlowEntry[]> {
  const url = new URL(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/champions/${encodeURIComponent(championKey)}/build-flow`
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
  return res.json() as Promise<ChampionBuildFlowEntry[]>;
}

export function useChampionBuildFlow(
  account: LolAccount | undefined,
  championKey: string,
  count = 200
) {
  return useQuery({
    queryKey: [
      "lol",
      "champion-build-flow",
      account?.region,
      account?.gameName,
      account?.tagLine,
      championKey,
      count,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchBuildFlow(account, championKey, count);
    },
    enabled: account !== undefined && championKey.length > 0,
  });
}
