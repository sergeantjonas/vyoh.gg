import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SteamSessions } from "@vyoh/shared";

export const SESSIONS_WEEKS = 12;

async function fetchSessions(weeks: number): Promise<SteamSessions> {
  const res = await fetch(`${API_URL}/steam/sessions?weeks=${weeks}`, {
    credentials: "include",
  });
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
  return res.json() as Promise<SteamSessions>;
}

// Not primed in the route loader, unlike the portrait: measured 2026-09-14 the
// twelve-week payload is 89 kB, half of it the off-camera ledger, and that is
// too much to inline into the document for a page whose hero needs 2 kB of
// it. The page renders its skeleton on the server and the hero cascades in
// on the client. Once the ledger is compact enough, priming is one line here
// and one in the route.
//
// Five minutes stale: the presence poller closes a session every two, so a
// tab left open sees a finished evening on the next focus rather than the one
// after. While a session is live the page polls at the poller's own cadence,
// so the hero swaps from the counter to the closed session within a tick of
// the game closing; the counter itself needs no fetch, it reads the clock.
export const LIVE_REFETCH_MS = 2 * 60 * 1_000;

export function sessionsQueryOptions(isOwner = false, weeks = SESSIONS_WEEKS) {
  return queryOptions({
    queryKey: ["steam", "sessions", weeks, viewerScope(isOwner)],
    queryFn: () => fetchSessions(weeks),
    staleTime: 5 * 60 * 1_000,
    refetchInterval: (query) => (query.state.data?.live ? LIVE_REFETCH_MS : false),
    ...viewerScopedQuery,
  });
}

export function useSteamSessions(weeks = SESSIONS_WEEKS) {
  return useQuery(sessionsQueryOptions(useIsOwner(), weeks));
}
