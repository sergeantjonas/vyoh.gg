import { CardShell } from "@/components/card-shell";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { SteamPlayerState } from "@vyoh/shared";
import { useState } from "react";
import { steamCapsuleUrl, steamLibraryHeroUrl } from "./_shared/steam-image";
import { useSteamPlayerState } from "./use-player-state";

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

function formatLifetime(minutes: number): string {
  if (minutes < 60) return `${minutes}m lifetime`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h lifetime`;
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

  if (game !== null) {
    return (
      <InGameHeroCard
        appid={game.appid}
        name={game.name}
        playtimeForeverMinutes={data.currentGamePlaytimeForeverMinutes}
      />
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

interface InGameHeroCardProps {
  appid: number;
  name: string;
  playtimeForeverMinutes: number | null;
}

// Bespoke layout — doesn't use CardShell. The hero backdrop is the whole
// surface: a faded, blurred library_hero behind a dark gradient with the
// title + LIVE indicator overlaid. Visual register is intentionally higher
// than the sibling Wishlist/Library chips — presence is transient, the
// catalog facts are not, and the chip should read that way.
function InGameHeroCard({ appid, name, playtimeForeverMinutes }: InGameHeroCardProps) {
  // wsrv.nl forwards upstream 404s as 200-OK-empty-bytes, so a missing
  // hero asset fires `onLoad` instead of `onError`. Promote zero-width
  // loads to the failed branch so the capsule fallback actually renders.
  // (Same pattern as routes/steam/game.$appid.tsx.)
  const [heroFailed, setHeroFailed] = useState(false);
  const handleHeroLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.naturalWidth === 0) setHeroFailed(true);
  };

  return (
    <Link
      to="/steam/game/$appid"
      params={{ appid: String(appid) }}
      className="group relative flex h-44 flex-col justify-between overflow-hidden rounded-lg border border-emerald-500/40 outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      {/* Capsule fallback sits underneath always — covers the loading
          frame before the hero streams in *and* serves as the permanent
          backdrop when library_hero 404s on older titles. */}
      <img
        src={steamCapsuleUrl(appid, null, null, 920)}
        alt=""
        className="absolute inset-0 size-full scale-110 object-cover blur-sm"
      />
      {!heroFailed && (
        <img
          src={steamLibraryHeroUrl(appid, null, null, 1280)}
          alt=""
          loading="eager"
          onLoad={handleHeroLoad}
          onError={() => setHeroFailed(true)}
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      )}
      {/* Dark wash so the overlaid text stays legible regardless of
          how bright the hero art is. Slightly stronger at the bottom
          where the title sits. */}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/45 to-black/30" />
      {/* Emerald edge glow on hover — a hair more than the static
          border, just enough to register the pointer interaction. */}
      <div className="absolute inset-0 opacity-0 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.5)] transition-opacity duration-300 group-hover:opacity-100" />

      <header className="relative flex items-center justify-between gap-2 px-4 pt-4">
        <h3 className="text-xs uppercase tracking-wide text-white/70">Now playing</h3>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-300">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Live
        </span>
      </header>

      <div className="relative flex flex-col gap-0.5 px-4 pb-4">
        <p className="text-lg font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          {name}
        </p>
        {playtimeForeverMinutes !== null && playtimeForeverMinutes > 0 && (
          <p className="text-xs text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {formatLifetime(playtimeForeverMinutes)}
          </p>
        )}
      </div>
    </Link>
  );
}
