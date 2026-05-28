import { useMe } from "@/identity/use-me";
import { useLiveGame } from "@/lol/matches/use-live-match";
import { useSteamPlayerState } from "@/steam/use-player-state";
import type { LolAccount } from "@vyoh/shared";

// Root-level subscribers that keep the live-presence queries warm regardless
// of which section the user is viewing. The favicon-dot hook reads these
// queries via partial-match keys, so without root-level mounts the dot only
// reflects the currently-viewed account/section. These components render
// null — their sole job is to mount the queries for side effects.
//
// Live updates rely on a 60s poll rather than the per-account SSE: an owner
// can have ~10 known accounts, and one EventSource per account saturates
// Firefox's per-origin HTTP/1 connection cap (6) — leftover connections fail
// with "CORS request did not succeed / Status code: (null)". The currently-
// viewed account still mounts `useLiveGameEvents` from inside its route, so
// the section the owner is actively looking at remains push-driven; the
// favicon-dot for non-viewed accounts updates with up to ~60s latency.

function LolAccountPresence({ account }: { account: LolAccount }) {
  useLiveGame(account, { refetchIntervalMs: 60_000 });
  return null;
}

function SteamPresence() {
  useSteamPlayerState();
  return null;
}

export function PresenceMounts() {
  const me = useMe();
  const accounts = me.data?.lol ?? [];
  return (
    <>
      <SteamPresence />
      {accounts.map((a) => (
        <LolAccountPresence key={a.slug} account={a} />
      ))}
    </>
  );
}
