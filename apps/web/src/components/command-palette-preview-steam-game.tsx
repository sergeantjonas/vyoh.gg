// Steam-game preview content for the command-palette anchor overlay (Chunk 3d
// of anchor-positioned-overlays.md). Reads owned-games and library-completion
// directly from queryClient — both are cached for the duration of any Steam
// session, so the preview piggybacks the same warm cache the dialog's library
// filter already consumes rather than refetching.

import { steamLibraryCapsuleUrl } from "@/steam/_shared/steam-image";
import { useQueryClient } from "@tanstack/react-query";
import type { SteamLibraryCompletion, SteamOwnedGames } from "@vyoh/shared";
import { formatPlaytime } from "@vyoh/shared";

type Props = {
  appid: string;
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommandPalettePreviewSteamGame({ appid }: Props) {
  const queryClient = useQueryClient();
  const owned = queryClient.getQueryData<SteamOwnedGames>(["steam", "owned-games"]);
  const completion = queryClient.getQueryData<SteamLibraryCompletion>([
    "steam",
    "achievements",
    "library-completion",
  ]);

  const appidNum = Number(appid);
  if (!Number.isFinite(appidNum)) return null;
  const game = owned?.games.find((g) => g.appid === appidNum);
  if (!game) return null;

  const capsuleUrl = steamLibraryCapsuleUrl(game.appid, game.assetTimestamp);
  const lifetime = formatPlaytime(game.playtimeForeverMinutes);
  const lastPlayed = game.rtimeLastPlayedAt ? relativeTime(game.rtimeLastPlayedAt) : null;

  const completionRow = completion?.stats.find((s) => s.appid === appidNum);
  const percent =
    completionRow && completionRow.total > 0
      ? Math.round((completionRow.unlocked / completionRow.total) * 100)
      : null;

  return (
    <aside
      data-testid="command-palette-preview"
      data-preview-type="steam-game"
      aria-hidden
      className="pointer-events-none flex w-64 flex-col gap-2 rounded-md border bg-popover/85 px-3 py-3 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <img
          src={capsuleUrl}
          alt=""
          loading="lazy"
          className="h-16 w-12 shrink-0 rounded-sm object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{game.name}</div>
          {game.developerNames[0] && (
            <div className="truncate text-muted-foreground">{game.developerNames[0]}</div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        <span className="text-foreground">{lifetime} lifetime</span>
        {lastPlayed && <span>last played {lastPlayed}</span>}
        {percent !== null && (
          <span data-testid="achievement-percent" className="tabular-nums">
            {percent}% unlocked
          </span>
        )}
      </div>
    </aside>
  );
}
