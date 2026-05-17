import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { CurrentPatchChangesResponse } from "@vyoh/shared";

const API_URL = "http://localhost:2010";

async function fetchCurrentPatchChanges(
  champions: readonly string[]
): Promise<CurrentPatchChangesResponse> {
  const url = new URL(`${API_URL}/lol/patches/current/changes`);
  for (const c of champions) url.searchParams.append("champion", c);

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
  return res.json() as Promise<CurrentPatchChangesResponse>;
}

// Patch data refreshes at most every 2 weeks; the underlying cron runs every
// 6h. Keeping it fresh in-app for one minute is plenty and avoids re-querying
// on every tile remount within a profile session.
const STALE_TIME_MS = 60_000;

export function useCurrentPatchChanges(champions: readonly string[]) {
  return useQuery({
    queryKey: ["lol", "patches", "current", "changes", [...champions].sort()],
    queryFn: () => fetchCurrentPatchChanges(champions),
    enabled: champions.length > 0,
    staleTime: STALE_TIME_MS,
  });
}
