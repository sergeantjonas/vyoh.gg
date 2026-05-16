import { CardShell } from "@/components/card-shell";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { SteamPlayerState } from "@vyoh/shared";
import { steamCapsuleUrl } from "./_shared/steam-image";
import { useSteamPlayerState } from "./use-player-state";

// Maps the persona-state union onto a status dot color + label. Online but
// not in-game gets the regular online color; in-game overrides to emerald
// elsewhere in the component, so this just covers the non-playing states.
const PERSONA_DOT: Record<
  SteamPlayerState["personaState"],
  { color: string; label: string }
> = {
  online: { color: "bg-sky-400", label: "Online" },
  busy: { color: "bg-amber-400", label: "Busy" },
  away: { color: "bg-amber-300", label: "Away" },
  snooze: { color: "bg-amber-300", label: "Snoozing" },
  "looking-to-trade": { color: "bg-violet-400", label: "Trading" },
  "looking-to-play": { color: "bg-violet-400", label: "LFG" },
  offline: { color: "bg-muted-foreground/40", label: "Offline" },
};

const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function relativeTimeSince(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, "hour");
  const days = Math.round(hours / 24);
  return relativeTime.format(days, "day");
}

export function NowPlayingChip() {
  const { data, isPending, isError } = useSteamPlayerState();

  if (isPending) {
    return <CardShell title="Now playing" verdict="Checking presence…" empty />;
  }

  if (isError || !data) {
    return (
      <CardShell title="Now playing" verdict="Presence is unavailable right now." empty />
    );
  }

  const game = data.currentGame;

  // In-game pulls the visual treatment further forward than the rest of the
  // chip grid: an emerald accent strip + a pulsing live dot. The other chips
  // are catalog facts that don't change minute-to-minute; this one does, and
  // the styling reflects that. When not in-game we fall back to the regular
  // chip rhythm so the slot doesn't shout for attention.
  if (game !== null) {
    return (
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(game.appid) }}
        className="group rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400/60"
      >
        <CardShell
          className="border-emerald-500/40 border-l-2 border-l-emerald-500 bg-emerald-500/4 transition-colors group-hover:bg-emerald-500/8"
          title="Now playing"
          indicator={
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
          }
          verdict={game.name}
          evidence={
            <div className="flex items-center gap-3">
              <img
                src={steamCapsuleUrl(game.appid)}
                alt=""
                loading="lazy"
                className="h-14.5 w-38.5 rounded-sm border border-emerald-500/20 object-cover"
              />
              <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground/80">
                Open game →
              </span>
            </div>
          }
        />
      </Link>
    );
  }

  const dot = PERSONA_DOT[data.personaState];
  return (
    <CardShell
      title="Now playing"
      indicator={
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
          <span className={cn("size-2 rounded-full", dot.color)} />
          {dot.label}
        </span>
      }
      verdict="Not in a game right now."
      empty
      evidence={
        <p className="text-xs text-muted-foreground/70">
          Last checked {relativeTimeSince(data.lastPolledAt)}.
        </p>
      }
    />
  );
}
