import { HttpError } from "@/lib/http-error";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CachedMatchesResult, LolAccount, MatchSummary } from "@vyoh/shared";

const API_URL = "http://localhost:2010";
export const MATCHES_PAGE_SIZE = 10;

async function fetchMatchesPage(
  account: LolAccount,
  start: number,
  count: number = MATCHES_PAGE_SIZE,
  queue?: number
): Promise<MatchSummary[]> {
  const params = new URLSearchParams({
    start: String(start),
    count: String(count),
  });
  if (queue !== undefined) params.set("queue", String(queue));
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

export function useMatches(account: LolAccount | undefined, queue?: number) {
  return useInfiniteQuery({
    queryKey: [
      "lol",
      "matches",
      account?.region,
      account?.gameName,
      account?.tagLine,
      queue,
    ],
    queryFn: ({ pageParam }) => {
      if (!account) throw new Error("No account");
      return fetchMatchesPage(account, pageParam, MATCHES_PAGE_SIZE, queue);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < MATCHES_PAGE_SIZE) return undefined;
      return lastPageParam + MATCHES_PAGE_SIZE;
    },
    enabled: account !== undefined,
  });
}

export function useCachedMatchSummary(matchId: string): MatchSummary | undefined {
  const queryClient = useQueryClient();
  const infinite = queryClient.getQueriesData<{ pages: MatchSummary[][] }>({
    queryKey: ["lol", "matches"],
  });
  for (const [, data] of infinite) {
    if (!data?.pages) continue;
    for (const page of data.pages) {
      const hit = page.find((m) => m.matchId === matchId);
      if (hit) return hit;
    }
  }
  const windows = queryClient.getQueriesData<MatchSummary[]>({
    queryKey: ["lol", "matches-window"],
  });
  for (const [, data] of windows) {
    if (!data) continue;
    const hit = data.find((m) => m.matchId === matchId);
    if (hit) return hit;
  }
  return undefined;
}

export function useMatchesWindow(
  account: LolAccount | undefined,
  count: number,
  queue?: number
) {
  return useQuery({
    queryKey: [
      "lol",
      "matches-window",
      account?.region,
      account?.gameName,
      account?.tagLine,
      count,
      queue,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchMatchesPage(account, 0, count, queue);
    },
    enabled: account !== undefined,
  });
}

async function fetchCachedMatches(
  account: LolAccount,
  count: number,
  queue?: number
): Promise<CachedMatchesResult> {
  const params = new URLSearchParams({ count: String(count) });
  if (queue !== undefined) params.set("queue", String(queue));
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/matches/cached?${params}`
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

export function useCachedMatchesWindow(
  account: LolAccount | undefined,
  count: number,
  queue?: number
) {
  return useQuery({
    queryKey: [
      "lol",
      "matches-cached",
      account?.region,
      account?.gameName,
      account?.tagLine,
      count,
      queue,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchCachedMatches(account, count, queue);
    },
    enabled: account !== undefined,
  });
}
