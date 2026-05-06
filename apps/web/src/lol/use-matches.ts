import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { LolAccount, MatchSummary } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchMatches(account: LolAccount): Promise<MatchSummary[]> {
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/matches`
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}

export function useMatches(account: LolAccount | undefined) {
  return useQuery({
    queryKey: ["lol", "matches", account?.region, account?.gameName, account?.tagLine],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchMatches(account);
    },
    enabled: account !== undefined,
  });
}
