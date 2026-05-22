import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { LolAccount, MatchNarrativeLifetime } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchNarrativeLifetime(
  account: LolAccount
): Promise<MatchNarrativeLifetime> {
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/narrative/lifetime`
  );
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON
    }
    throw new HttpError(res.status, message);
  }
  return res.json();
}

/**
 * Lifetime multikill totals across every non-remake game the owner played.
 * Cached for an hour — the answer doesn't change between syncs, so refetching
 * on every Profile mount would burn the JSON scan for nothing.
 */
export function useNarrativeLifetime(account: LolAccount | undefined) {
  return useQuery({
    queryKey: [
      "lol",
      "narrative",
      "lifetime",
      account?.region,
      account?.gameName,
      account?.tagLine,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchNarrativeLifetime(account);
    },
    enabled: account !== undefined,
    staleTime: 60 * 60 * 1000,
  });
}
