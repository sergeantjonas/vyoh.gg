import type { LiveMatch, SteamPlayerState } from "@vyoh/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const FAVICON_DEFAULT = "/vyoh-orb-favicon.svg";
const FAVICON_LIVE = "/vyoh-favicon-live.svg";
const FAVICON_FINISHED = "/vyoh-favicon-finished.svg";
// How long (ms) to show the "just finished" blue dot after a game ends.
const FINISHED_DURATION_MS = 60_000;

function setFavicon(href: string) {
  const el = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (el) el.href = href;
}

export function useFaviconDot() {
  const queryClient = useQueryClient();
  const prevLiveRef = useRef(false);
  const finishedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function isCurrentlyLive(): boolean {
      const playerState = queryClient.getQueryData<SteamPlayerState>(["steam", "player-state"]);
      if (playerState?.currentGame != null) return true;

      const lolQueries = queryClient.getQueriesData<LiveMatch | null>({
        queryKey: ["lol", "live"],
      });
      return lolQueries.some(([, data]) => data != null);
    }

    function update() {
      const live = isCurrentlyLive();

      if (live) {
        // Clear any pending "finished" timer — we're in-game again.
        if (finishedTimerRef.current !== null) {
          clearTimeout(finishedTimerRef.current);
          finishedTimerRef.current = null;
        }
        prevLiveRef.current = true;
        setFavicon(FAVICON_LIVE);
        return;
      }

      // Transition from live → not-live: show "just finished" dot briefly.
      if (prevLiveRef.current && finishedTimerRef.current === null) {
        setFavicon(FAVICON_FINISHED);
        finishedTimerRef.current = setTimeout(() => {
          finishedTimerRef.current = null;
          setFavicon(FAVICON_DEFAULT);
        }, FINISHED_DURATION_MS);
      }

      prevLiveRef.current = false;
    }

    update();
    const unsubscribe = queryClient.getQueryCache().subscribe(update);

    return () => {
      unsubscribe();
      if (finishedTimerRef.current !== null) clearTimeout(finishedTimerRef.current);
      setFavicon(FAVICON_DEFAULT);
    };
  }, [queryClient]);
}
