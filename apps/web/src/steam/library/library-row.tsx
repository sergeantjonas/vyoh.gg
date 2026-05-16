import { steamCapsuleUrl } from "@/steam/_shared/steam-image";
import { prefetchSteamGameBackdrop } from "@/steam/profile-backdrop";
import { Link } from "@tanstack/react-router";
import type { SteamOwnedGame } from "@vyoh/shared";

const DAY_MS = 86_400_000;
const relativeTime = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

function relativeTimeAgo(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / DAY_MS);
  if (Math.abs(days) < 30) return relativeTime.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 24) return relativeTime.format(months, "month");
  const years = Math.round(days / 365);
  return relativeTime.format(years, "year");
}

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

export function LibraryRow({ game }: { game: SteamOwnedGame }) {
  const lifetime =
    game.playtimeForeverMinutes > 0 ? formatPlaytime(game.playtimeForeverMinutes) : null;
  const twoWeeks =
    game.playtime2WeeksMinutes !== null && game.playtime2WeeksMinutes > 0
      ? formatPlaytime(game.playtime2WeeksMinutes)
      : null;
  // "Last played 6mo ago" hint for gone-quiet titles. Suppressed when the
  // 2-week marker is set — the latter already signals "active right now,"
  // and stacking both reads as noise on hot rows.
  const lastPlayed =
    game.rtimeLastPlayedAt !== null && twoWeeks === null
      ? relativeTimeAgo(game.rtimeLastPlayedAt)
      : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <img
        src={steamCapsuleUrl(game.appid, game.headerPath, game.assetTimestamp)}
        alt=""
        width={120}
        height={45}
        loading="lazy"
        className="h-11.25 w-30 flex-none rounded-sm bg-muted object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          to="/steam/game/$appid"
          params={{ appid: String(game.appid) }}
          onMouseEnter={() => prefetchSteamGameBackdrop(game.appid, game.assetTimestamp)}
          onFocus={() => prefetchSteamGameBackdrop(game.appid, game.assetTimestamp)}
          className="truncate text-sm font-medium underline-offset-2 hover:underline"
        >
          {game.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {lifetime ? `${lifetime} lifetime` : "Never launched"}
          {twoWeeks ? ` · ${twoWeeks} last two weeks` : ""}
          {lastPlayed ? ` · last played ${lastPlayed}` : ""}
        </span>
      </div>
    </li>
  );
}
