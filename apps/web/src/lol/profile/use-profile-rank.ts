import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { LolAccount, SummonerProfile } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

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

export function useProfileRank(account: LolAccount | undefined) {
  return useQuery({
    queryKey: ["lol", "rank", account?.region, account?.gameName, account?.tagLine],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchSummonerProfile(account);
    },
    enabled: account !== undefined,
  });
}
