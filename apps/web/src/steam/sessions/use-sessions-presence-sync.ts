import type { ViewerScope } from "@/auth/viewer-scope";
import { useQueryClient } from "@tanstack/react-query";
import type { SteamPlayerState } from "@vyoh/shared";
import { useEffect, useRef } from "react";

// The sessions payload is 45 kB and polls only while a session is already
// live, so a game launched with the page idle would sit unnoticed until the
// stale window ran out or the page reloaded. Player state is a separate
// 30-second poll mounted at the root for the app's lifetime; the moment it
// reports a different game (or none), the open row on the api has changed
// with it, and every sessions entry is marked stale — the hero refetches at
// once, an unmounted landing chip on its next mount.
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
  const previous = useRef<{ appid: number | null; scope: ViewerScope } | undefined>(
    undefined
  );
  useEffect(() => {
    if (appid === undefined) return;
    const last = previous.current;
    previous.current = { appid, scope };
    if (last === undefined) return;
    // A hidden game projects to no game publicly, so the owner's hydration
    // flips `null → appid` under the same clock tick; that is the key
    // changing, not the game.
    if (last.scope !== scope) return;
    if (last.appid !== appid) {
      void queryClient.invalidateQueries({ queryKey: ["steam", "sessions"] });
    }
  }, [appid, scope, queryClient]);
}
