import { useIsOwner } from "@/auth/use-viewer";
import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { DuoLpOverlay, LolAccount } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchDuoLp(account: LolAccount, count: number): Promise<DuoLpOverlay[]> {
  const url = new URL(
    `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/duos/lp`
  );
  url.searchParams.set("count", String(count));

  const res = await fetch(url, { credentials: "include" });
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
  return res.json() as Promise<DuoLpOverlay[]>;
}

/**
 * Owner-only rather than viewer-scoped: the api answers a visitor with 401, so
 * there is no public projection to keep apart in the cache — the query simply
 * doesn't run until the viewer resolves as the owner. Same `count` window as
 * `useDuos` so the two responses describe the same games.
 */
export function useDuoLp(account: LolAccount | undefined, count = 100) {
  const isOwner = useIsOwner();
  return useQuery({
    queryKey: [
      "lol",
      "duos",
      "lp",
      account?.region,
      account?.gameName,
      account?.tagLine,
      count,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchDuoLp(account, count);
    },
    enabled: account !== undefined && isOwner,
  });
}
