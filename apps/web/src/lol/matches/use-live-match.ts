import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LiveMatch, LolAccount } from "@vyoh/shared";
import { useEffect, useRef } from "react";

import { API_URL } from "@/lib/api-url";

type LiveGameEventPayload = {
  type: "game-started" | "game-ended";
  puuid: string;
};

type LiveGameEventCallbacks = {
  onGameStarted?: (event: LiveGameEventPayload) => void;
  onGameEnded?: (event: LiveGameEventPayload) => void;
};

function summonerBase(account: LolAccount): string {
  return `${API_URL}/lol/summoners/${encodeURIComponent(account.region)}/${encodeURIComponent(account.gameName)}/${encodeURIComponent(account.tagLine)}`;
}

async function fetchLiveGame(account: LolAccount): Promise<LiveMatch | null> {
  const res = await fetch(`${summonerBase(account)}/live`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // NestJS serializes a `null` controller return as an empty body, not "null",
  // so res.json() would throw "Unexpected end of JSON input" when the game ends.
  const text = await res.text();
  return text ? (JSON.parse(text) as LiveMatch | null) : null;
}

export function liveGameQueryKey(account: LolAccount | undefined) {
  return ["lol", "live", account?.region, account?.gameName, account?.tagLine] as const;
}

/**
 * Shared by `useLiveGame` and the profile route's loader so both build the same
 * cache key.
 *
 * Priming this one is what keeps the profile hero's live-game halo out of the
 * hydration diff. `PresenceMounts` calls `useLiveGame` from the root layout,
 * which is not code-split, while the profile page is — so on a cold load the
 * root's live fetch resolves *before* the profile chunk arrives to hydrate, and
 * the hydrating render sees a live game the server render did not. Awaiting it
 * in the loader makes both sides start from the same snapshot.
 */
export function liveGameQueryOptions(account: LolAccount | undefined) {
  return queryOptions({
    queryKey: liveGameQueryKey(account),
    queryFn: (): Promise<LiveMatch | null> => {
      if (!account) throw new Error("No account");
      return fetchLiveGame(account);
    },
    enabled: account !== undefined,
    staleTime: 30_000,
  });
}

export function useLiveGame(
  account: LolAccount | undefined,
  options?: { refetchIntervalMs?: number }
) {
  return useQuery({
    ...liveGameQueryOptions(account),
    refetchInterval: options?.refetchIntervalMs ?? false,
  });
}

// Subscribes to live-game SSE and invalidates the live game query on transitions.
// Optional callbacks fire alongside the invalidation; pass them to react to
// game-started / game-ended (e.g. toast notifications). Callbacks are read
// through a ref so changing their identity doesn't tear down the EventSource.
export function useLiveGameEvents(
  account: LolAccount | undefined,
  callbacks?: LiveGameEventCallbacks
): void {
  const queryClient = useQueryClient();
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const region = account?.region;
  const gameName = account?.gameName;
  const tagLine = account?.tagLine;

  useEffect(() => {
    if (!region || !gameName || !tagLine) return;
    const acc: LolAccount = { region, gameName, tagLine, slug: "" };

    const url = `${summonerBase(acc)}/live/events`;
    const source = new EventSource(url);

    const onEvent = (e: MessageEvent) => {
      void queryClient.invalidateQueries({ queryKey: liveGameQueryKey(acc) });
      try {
        const payload = JSON.parse(e.data) as LiveGameEventPayload;
        if (import.meta.env.DEV) {
          console.debug("[live] event", payload.type, payload.puuid);
        }
        if (payload.type === "game-started") {
          callbacksRef.current?.onGameStarted?.(payload);
        } else if (payload.type === "game-ended") {
          callbacksRef.current?.onGameEnded?.(payload);
        }
      } catch (err) {
        console.warn("[live] failed to parse event payload", err);
      }
    };

    source.addEventListener("live-game-updated", onEvent);

    return () => {
      source.removeEventListener("live-game-updated", onEvent);
      source.close();
    };
  }, [region, gameName, tagLine, queryClient]);
}
