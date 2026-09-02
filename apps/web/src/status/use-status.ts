import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LolAccount,
  MatchSyncResult,
  StatusSnapshot,
  SyncJobTriggerResult,
  SyncStatus,
  SyncTick,
  SyncTriggerResult,
} from "@vyoh/shared";
import { useEffect } from "react";

import { viewerQueryKey } from "@/auth/use-viewer";
import { API_URL } from "@/lib/api-url";
import { HttpError } from "@/lib/http-error";
import { ownerRequest } from "@/lib/owner-request";

async function fetchStatus(): Promise<StatusSnapshot> {
  const res = await fetch(`${API_URL}/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const post = <T>(path: string): Promise<T> => ownerRequest<T>("POST", path);

/**
 * Re-lock the UI when a write comes back 401.
 *
 * Only reachable if the session died between page load and the click — the
 * buttons are disabled for everyone else — so the cached `isOwner: true` is now
 * a lie the controls are still being rendered against. Dropping it flips them
 * back to their locked state on the next paint.
 *
 * No redirect, and no toast of its own: the message is already carried on the
 * error, which the router's `MutationCache.onError` surfaces for every mutation
 * in the app.
 */
function useRelockOnUnauthorized() {
  const queryClient = useQueryClient();
  return (error: Error) => {
    if (error instanceof HttpError && error.status === 401) {
      void queryClient.invalidateQueries({ queryKey: viewerQueryKey });
    }
  };
}

export function useStatus() {
  return useQuery<StatusSnapshot>({
    queryKey: ["status"],
    queryFn: fetchStatus,
    // Initial fetch — the SSE stream then pushes updates and keeps this cache
    // hot. Polling fallback handles the brief gap before the EventSource
    // connects (and is a no-op once events start arriving).
    refetchInterval: 5_000,
    staleTime: 0,
  });
}

// Subscribes to the status SSE stream and pushes snapshots / tick events
// straight into the React Query cache. The `useStatus` query becomes a
// passive consumer of the streamed cache.
export function useStatusStream(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(`${API_URL}/status/stream`);

    const onSnapshot = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as StatusSnapshot;
        queryClient.setQueryData(["status"], data);
      } catch (err) {
        console.warn("[status] failed to parse snapshot", err);
      }
    };

    const onTick = (e: MessageEvent) => {
      try {
        const tick = JSON.parse(e.data) as SyncTick;
        if (import.meta.env.DEV) {
          console.debug("[status] tick", tick.durationMs, "ms");
        }
        // Force a refetch so the new tick is reflected immediately — even
        // though the next snapshot frame would also carry it, the explicit
        // refetch shaves ~2 s off the perceived "tick just finished" UI.
        void queryClient.invalidateQueries({ queryKey: ["status"] });
      } catch (err) {
        console.warn("[status] failed to parse tick", err);
      }
    };

    source.addEventListener("snapshot", onSnapshot);
    source.addEventListener("tick", onTick);

    return () => {
      source.removeEventListener("snapshot", onSnapshot);
      source.removeEventListener("tick", onTick);
      source.close();
    };
  }, [queryClient]);
}

// The cron mutations patch the cached sync state in-place on success so the
// dashboard reflects the new state without waiting for the next 2 s SSE
// snapshot frame. We don't invalidate — the streamed snapshot will overwrite
// our optimistic patch the moment it arrives, so any drift self-corrects.

export function useSyncNow() {
  const queryClient = useQueryClient();
  const onError = useRelockOnUnauthorized();
  return useMutation<SyncTriggerResult>({
    mutationFn: () => post<SyncTriggerResult>("/status/sync"),
    onSuccess: (result) => {
      queryClient.setQueryData<StatusSnapshot>(["status"], (prev) =>
        prev ? { ...prev, sync: result.status } : prev
      );
    },
    onError,
  });
}

export function useSetSyncEnabled() {
  const queryClient = useQueryClient();
  const onError = useRelockOnUnauthorized();
  return useMutation<SyncStatus, Error, boolean>({
    mutationFn: (enabled) =>
      post<SyncStatus>(enabled ? "/status/sync/resume" : "/status/sync/pause"),
    onSuccess: (status) => {
      queryClient.setQueryData<StatusSnapshot>(["status"], (prev) =>
        prev ? { ...prev, sync: status } : prev
      );
    },
    onError,
  });
}

export function useSyncPatches() {
  const queryClient = useQueryClient();
  const onError = useRelockOnUnauthorized();
  return useMutation<SyncJobTriggerResult>({
    mutationFn: () => post<SyncJobTriggerResult>("/status/sync/patches"),
    // Patches the one job row rather than the whole snapshot: the response
    // carries only the job it triggered, and every other row in `jobs` is
    // still current.
    onSuccess: (result) => {
      queryClient.setQueryData<StatusSnapshot>(["status"], (prev) =>
        prev
          ? {
              ...prev,
              jobs: prev.jobs.map((job) =>
                job.name === result.job.name ? result.job : job
              ),
            }
          : prev
      );
    },
    onError,
  });
}

export function useSyncAccount() {
  const queryClient = useQueryClient();
  const onError = useRelockOnUnauthorized();
  return useMutation<MatchSyncResult, Error, LolAccount>({
    mutationFn: (account) =>
      post<MatchSyncResult>(
        `/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}/matches/sync`
      ),
    // No cache patch — the per-account sync runs outside the cron tick, so
    // the dashboard's lastTick view legitimately doesn't change. Refresh
    // anyway in case the manual sync raced with an in-flight tick.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["status"] });
    },
    onError,
  });
}
