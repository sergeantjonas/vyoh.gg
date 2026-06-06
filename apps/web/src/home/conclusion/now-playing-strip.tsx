import { SHADOW_BODY, SHADOW_LABEL } from "@/home/recap/chapter-shadows";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { useLiveGame } from "@/lol/matches/use-live-match";
import { useSteamPlayerState } from "@/steam/use-player-state";
import type { LiveMatch, SteamPlayerState } from "@vyoh/shared";
import { queueLabel } from "@vyoh/shared";

// PresenceMounts already runs the live-game + steam-player-state pollers at
// the root; we just READ those queries here. No `refetchIntervalMs` on
// useLiveGame so this component doesn't double-poll. Steam's polling cadence
// is set inside its hook unconditionally — same pattern.

function formatLolDuration(liveGame: LiveMatch): string {
  // gameLength is seconds-elapsed at last poll; polledAt is the wall-clock
  // moment of that poll. Advance the clock client-side so the chip reads
  // honestly even when the next poll is up to 60s away.
  const elapsedSec =
    liveGame.gameLength + Math.floor((Date.now() - liveGame.polledAt) / 1_000);
  if (elapsedSec < 60) return `${elapsedSec}s in`;
  const minutes = Math.floor(elapsedSec / 60);
  return `${minutes}m in`;
}

interface ResolvedStream {
  kind: "lol" | "steam";
  primary: string;
  detail: string;
}

function resolveStream(
  liveGame: LiveMatch | null | undefined,
  steam: SteamPlayerState | undefined
): ResolvedStream | null {
  if (liveGame) {
    return {
      kind: "lol",
      primary: queueLabel(liveGame.queueId),
      detail: formatLolDuration(liveGame),
    };
  }
  if (steam?.currentGame) {
    return {
      kind: "steam",
      primary: steam.currentGame.name,
      detail: "On Steam",
    };
  }
  return null;
}

function StreamDot({ kind }: { kind: ResolvedStream["kind"] }) {
  // Two distinct accents keep LoL / Steam visually distinguishable at a
  // glance. Sky for LoL matches the queue-tile palette used elsewhere on
  // the page; amber for Steam matches the unlock badge family.
  const color = kind === "lol" ? "bg-sky-400" : "bg-amber-400";
  return (
    <span className="relative flex size-2 shrink-0 items-center justify-center">
      <span
        className={`absolute inline-flex size-full animate-ping rounded-full ${color} opacity-70`}
        aria-hidden
      />
      <span className={`relative inline-flex size-2 rounded-full ${color}`} />
    </span>
  );
}

/**
 * Conclusion now-playing pulse. Hides unless the owner is in a live LoL game
 * or has Steam reporting an active game. Reads through the existing root-
 * level pollers (`PresenceMounts`) so adding the chip costs zero new
 * network calls. LoL takes precedence over Steam when both are live — a
 * League queue is the more specific subject.
 */
export function NowPlayingStrip() {
  const { account } = usePrimaryAccount();
  const liveQuery = useLiveGame(account);
  const steamQuery = useSteamPlayerState();
  const stream = resolveStream(liveQuery.data, steamQuery.data);

  if (!stream) return null;

  return (
    <section className="flex justify-center">
      <div className="inline-flex items-center gap-3 text-sm text-foreground/90">
        <StreamDot kind={stream.kind} />
        <span
          className="text-[10px] uppercase tracking-[0.2em] text-foreground/70"
          style={{ textShadow: SHADOW_LABEL }}
        >
          Now playing
        </span>
        <span className="font-medium" style={{ textShadow: SHADOW_BODY }}>
          {stream.primary}
        </span>
        <span aria-hidden className="text-foreground/40">
          ·
        </span>
        <span
          className="text-foreground/65 tabular-nums"
          style={{ textShadow: SHADOW_LABEL }}
        >
          {stream.detail}
        </span>
      </div>
    </section>
  );
}
