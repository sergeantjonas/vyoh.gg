import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { LolAccount, RankHistoryResponse } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

export type RangeKey = "30d" | "90d" | "season";

const RANGE_DAYS: Record<RangeKey, number | undefined> = {
  "30d": 30,
  "90d": 90,
  season: undefined,
};

async function fetchRankHistory(
  account: LolAccount,
  days: number | undefined
): Promise<RankHistoryResponse> {
  const url = new URL(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/rank/history`
  );
  if (days !== undefined) url.searchParams.set("days", String(days));

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
  return res.json() as Promise<RankHistoryResponse>;
}

export function useRankHistory(account: LolAccount | undefined, range: RangeKey) {
  return useQuery({
    queryKey: [
      "lol",
      "rank-history",
      account?.region,
      account?.gameName,
      account?.tagLine,
      range,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchRankHistory(account, RANGE_DAYS[range]);
    },
    enabled: account !== undefined,
  });
}
