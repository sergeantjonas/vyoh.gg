import { HttpError } from "@/lib/http-error";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

  const cachedInfinite = queryClient.getQueriesData<{
    pages: CachedMatchesResult[];
  }>({ queryKey: ["lol", "matches-cached-infinite"] });
  for (const [, data] of cachedInfinite) {
    if (!data?.pages) continue;
    for (const page of data.pages) {
      const hit = page.matches.find((m) => m.matchId === matchId);
      if (hit) return hit;
    }
  }

  const cachedWindows = queryClient.getQueriesData<CachedMatchesResult>({
    queryKey: ["lol", "matches-cached"],
  });
  for (const [, data] of cachedWindows) {
    const hit = data?.matches.find((m) => m.matchId === matchId);
    if (hit) return hit;
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
  start: number,
  count: number,
  queue?: number
): Promise<CachedMatchesResult> {
  const params = new URLSearchParams({
    start: String(start),
    count: String(count),
  });
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
      return fetchCachedMatches(account, 0, count, queue);
    },
    enabled: account !== undefined,
  });
}

type SyncResult = { idCount: number; backfilled: number };

async function postSyncAccount(account: LolAccount): Promise<SyncResult> {
  const res = await fetch(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/matches/sync`,
    { method: "POST" }
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

export function useSyncAccount(account: LolAccount | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!account) throw new Error("No account");
      return postSyncAccount(account);
    },
    onSuccess: () => {
      // Invalidate every cached-matches query for this account so the views
      // refetch from the now-fresher DB.
      const keyPrefix = [account?.region, account?.gameName, account?.tagLine];
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey;
          if (!Array.isArray(key) || key[0] !== "lol") return false;
          const kind = key[1];
          if (kind !== "matches-cached" && kind !== "matches-cached-infinite") {
            return false;
          }
          return (
            key[2] === keyPrefix[0] && key[3] === keyPrefix[1] && key[4] === keyPrefix[2]
          );
        },
      });
    },
  });
}

export function useCachedMatches(account: LolAccount | undefined, queue?: number) {
  return useInfiniteQuery({
    queryKey: [
      "lol",
      "matches-cached-infinite",
      account?.region,
      account?.gameName,
      account?.tagLine,
      queue,
    ],
    queryFn: ({ pageParam }) => {
      if (!account) throw new Error("No account");
      return fetchCachedMatches(account, pageParam, MATCHES_PAGE_SIZE, queue);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const consumed = lastPageParam + lastPage.matches.length;
      if (consumed >= lastPage.total) return undefined;
      // If a page comes back shorter than asked-for and we haven't reached
      // total, the underlying DB cache simply has gaps — bail to avoid
      // infinite re-asking for the same window.
      if (lastPage.matches.length === 0) return undefined;
      return consumed;
    },
    enabled: account !== undefined,
  });
}
