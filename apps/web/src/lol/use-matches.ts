import { HttpError } from "@/lib/http-error";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { LolAccount, MatchSummary } from "@vyoh/shared";

const API_URL = "http://localhost:2010";
export const MATCHES_PAGE_SIZE = 20;
const AUTO_LOAD_CAP = 200;

async function fetchMatchesPage(
  account: LolAccount,
  start: number,
  count: number = MATCHES_PAGE_SIZE
): Promise<MatchSummary[]> {
  const params = new URLSearchParams({
    start: String(start),
    count: String(count),
  });
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/matches?${params}`
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
  return useInfiniteQuery({
    queryKey: ["lol", "matches", account?.region, account?.gameName, account?.tagLine],
    queryFn: ({ pageParam }) => {
      if (!account) throw new Error("No account");
      return fetchMatchesPage(account, pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < MATCHES_PAGE_SIZE) return undefined;
      const next = lastPageParam + MATCHES_PAGE_SIZE;
      if (next >= AUTO_LOAD_CAP) return undefined;
      return next;
    },
    enabled: account !== undefined,
  });
}

export function useMatchesWindow(account: LolAccount | undefined, count: number) {
  return useQuery({
    queryKey: [
      "lol",
      "matches-window",
      account?.region,
      account?.gameName,
      account?.tagLine,
      count,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchMatchesPage(account, 0, count);
    },
    enabled: account !== undefined,
  });
}
