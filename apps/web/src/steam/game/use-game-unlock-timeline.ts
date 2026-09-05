import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { HttpError } from "@/lib/http-error";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { GameUnlockTimeline } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchGameUnlockTimeline(appid: number): Promise<GameUnlockTimeline> {
  const res = await fetch(`${API_URL}/steam/game/${appid}/unlock-timeline`, {
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
  return res.json() as Promise<GameUnlockTimeline>;
}

export function gameUnlockTimelineQueryOptions(appid: number, isOwner = false) {
  return queryOptions({
    queryKey: ["steam", "game", appid, "unlock-timeline", viewerScope(isOwner)],
    queryFn: () => fetchGameUnlockTimeline(appid),
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}

export function useGameUnlockTimeline(appid: number) {
  return useQuery(gameUnlockTimelineQueryOptions(appid, useIsOwner()));
}
