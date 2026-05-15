import { steamCapsuleUrl } from "@/steam/_shared/steam-image";
import { Link } from "@tanstack/react-router";
import type { SteamOwnedGame } from "@vyoh/shared";

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

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <img
        src={steamCapsuleUrl(game.appid)}
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
          className="truncate text-sm font-medium underline-offset-2 hover:underline"
        >
          {game.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {lifetime ? `${lifetime} lifetime` : "Never launched"}
          {twoWeeks ? ` · ${twoWeeks} last two weeks` : ""}
        </span>
      </div>
    </li>
  );
}
