import type { ViewerScope } from "@/auth/viewer-scope";
import { useQueryClient } from "@tanstack/react-query";
import type { SteamPlayerState } from "@vyoh/shared";
import { LIVE_POLL_FRESH_MS } from "@vyoh/shared";
import { useEffect, useRef } from "react";

// The sessions payload is 45 kB and polls only while a session is already
// live, so a game launched with the page idle would sit unnoticed until the
// stale window ran out or the page reloaded. Player state is a separate
// 30-second poll mounted at the root for the app's lifetime; the moment it
// reports a different game (or none), the open row on the api has changed
// with it, and every sessions entry is marked stale — the hero refetches at
// once, an unmounted landing chip on its next mount.
//
// The poll coming back after a gap longer than `LIVE_POLL_FRESH_MS` does the
// same. While Steam is down the state row keeps its last game and stops
// advancing, so the api stops calling the open row live, the page stops
// polling, and when Steam answers again with the same game there is no
// transition to report — without this the hero sits on the closed session
// until the page remounts or the game changes. A tab back from the
// background after the same stretch trips it too, on purpose: its poll was
// paused over the same unobserved window, and one refetch is the cost.
//
// Mounted at the root rather than in the Steam section so a launch seen on
// `/` still marks the entry stale before the owner navigates into Steam.
export function useSessionsPresenceSync(
  playerState: SteamPlayerState | undefined,
  scope: ViewerScope
) {
  const queryClient = useQueryClient();
  const appid =
    playerState === undefined ? undefined : (playerState.currentGame?.appid ?? null);
  const polledAt =
    playerState === undefined ? undefined : Date.parse(playerState.lastPolledAt);
  const previous = useRef<
    { appid: number | null; polledAt: number; scope: ViewerScope } | undefined
  >(undefined);
  useEffect(() => {
    if (appid === undefined || polledAt === undefined) return;
    const last = previous.current;
    previous.current = { appid, polledAt, scope };
    if (last === undefined) return;
    // A hidden game projects to no game publicly, so the owner's hydration
    // flips `null → appid` under the same clock tick; that is the key
    // changing, not the game.
    if (last.scope !== scope) return;
    const resumed = polledAt - last.polledAt > LIVE_POLL_FRESH_MS;
    if (last.appid !== appid || resumed) {
      void queryClient.invalidateQueries({ queryKey: ["steam", "sessions"] });
    }
  }, [appid, polledAt, scope, queryClient]);
}
