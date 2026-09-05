import { useIsOwner } from "@/auth/use-viewer";
import { viewerScope, viewerScopedQuery } from "@/auth/viewer-scope";
import { HttpError } from "@/lib/http-error";
import { useQuery } from "@tanstack/react-query";
import type { SteamCompletionCandidates } from "@vyoh/shared";

import { API_URL } from "@/lib/api-url";

async function fetchCompletionCandidates(): Promise<SteamCompletionCandidates> {
  const res = await fetch(`${API_URL}/steam/achievements/completion-candidates`, {
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
  return res.json() as Promise<SteamCompletionCandidates>;
}

// Ranked server-side; the surfaces only cap what they show. Same 30min
// stale-time as library completion — both move on the daily unlocks poller.
export function useCompletionCandidates() {
  const scope = viewerScope(useIsOwner());
  return useQuery({
    queryKey: ["steam", "achievements", "completion-candidates", scope],
    queryFn: fetchCompletionCandidates,
    staleTime: 30 * 60 * 1_000,
    ...viewerScopedQuery,
  });
}
