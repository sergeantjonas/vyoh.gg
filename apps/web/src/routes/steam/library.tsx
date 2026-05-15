import { steamCapsuleUrl } from "@/steam/_shared/steam-image";
import { useSteamForeverGames } from "@/steam/use-forever-games";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { SteamForeverGame } from "@vyoh/shared";

export const Route = createFileRoute("/steam/library")({
  component: LibraryPage,
});

function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

function LibraryPage() {
  const { data, isPending, isError } = useSteamForeverGames();

  // The endpoint already returns lifetime-desc; treating it as the source of
  // truth here keeps the "most-played first" framing aligned across the chip
  // and the drill-in. Untouched titles (playtime_forever === 0) fall to the
  // bottom — kept visible because the library's own "untouched" count is the
  // backlog-inside-the-library narrative the LibraryCompositionChip surfaces.
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Forever games</h1>
        <p className="text-sm text-muted-foreground">
          Currently-owned Steam library, sorted by lifetime playtime. Last two weeks shown
          where Steam reported activity.
        </p>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading library…</p>}

      {isError && (
        <p className="text-sm text-destructive">Library is unavailable right now.</p>
      )}

      {data && data.games.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Library hasn't synced yet — first poll lands at 04:00 Brussels time.
        </p>
      )}

      {data && data.games.length > 0 && (
        <ul className="flex flex-col divide-y divide-border/40 rounded-lg border bg-card/50">
          {data.games.map((game) => (
            <LibraryRow key={game.appid} game={game} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LibraryRow({ game }: { game: SteamForeverGame }) {
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
