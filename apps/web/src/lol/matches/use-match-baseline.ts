import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { LolAccount, MatchBaseline } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchMatchBaseline(
  account: LolAccount,
  championAlias: string,
  role: string
): Promise<MatchBaseline> {
  const { region, gameName, tagLine } = account;
  const url = `${API_URL}/lol/summoners/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}/baselines/${encodeURIComponent(championAlias)}/${encodeURIComponent(role)}`;
  const res = await fetch(url);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body?.message === "string") message = body.message;
    } catch {
      // not JSON — keep fallback
    }
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<MatchBaseline>;
}

export function useMatchBaseline(
  account: LolAccount | undefined,
  championAlias: string | undefined,
  role: string | undefined
) {
  return useQuery({
    queryKey: ["lol", "baseline", account?.slug, championAlias, role],
    queryFn: () =>
      account && championAlias && role
        ? fetchMatchBaseline(account, championAlias, role)
        : Promise.reject(new Error("unreachable")),
    enabled: !!account && !!championAlias && !!role,
    staleTime: 5 * 60 * 1000,
  });
}
