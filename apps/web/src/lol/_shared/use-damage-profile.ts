import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { DamageProfile, LolAccount } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

// One endpoint, two scopes: with a `championKey` it hits the champion-scoped
// route, without it the profile-wide one. The radar component is the same in
// both places — only the data window differs.
async function fetchDamageProfile(
  account: LolAccount,
  championKey: string | undefined,
  count: number
): Promise<DamageProfile> {
  const base = `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}`;
  const path = championKey
    ? `${base}/champions/${encodeURIComponent(championKey)}/damage-profile`
    : `${base}/damage-profile`;
  const url = new URL(path);
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
  return res.json() as Promise<DamageProfile>;
}

export function useDamageProfile(
  account: LolAccount | undefined,
  championKey?: string,
  count = 100
) {
  return useQuery({
    queryKey: [
      "lol",
      "damage-profile",
      account?.region,
      account?.gameName,
      account?.tagLine,
      championKey ?? null,
      count,
    ],
    queryFn: () => {
      if (!account) throw new Error("No account");
      return fetchDamageProfile(account, championKey, count);
    },
    enabled: account !== undefined,
  });
}
