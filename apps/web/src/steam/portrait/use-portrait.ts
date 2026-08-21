import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamPortrait } from "@vyoh/shared";

async function fetchPortrait(): Promise<SteamPortrait> {
  const res = await fetch(`${API_URL}/steam/portrait`, { credentials: "include" });
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
  return res.json() as Promise<SteamPortrait>;
}

// Primed in the /steam loader. Measured 2026-08-02 it is 3.6 kB computed in
// ~15 ms off our own Postgres, and the Portrait's claims are the closest thing
// this page has to indexable prose — it passes all three questions in the
// "server-render the routes a crawler cares about" rule, where the sibling
// summary endpoint fails the latency one.
//
// Recomputed from the daily 04:00 Europe/Brussels playtime snapshot, so the
// answer cannot change more than once a day.
export function portraitQueryOptions(isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "portrait", viewerScope(isOwner)],
    queryFn: fetchPortrait,
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}

export function useSteamPortrait() {
  return useQuery(portraitQueryOptions(useIsOwner()));
}
