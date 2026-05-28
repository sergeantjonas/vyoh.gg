// Match preview content for the command-palette anchor overlay (Chunk 3c of
// anchor-positioned-overlays.md). Receives an already-resolved MatchSummary
// from the dispatcher so the lookup keying (cached account → infinite-query
// data) stays where it already lives in CommandPaletteDialog, instead of
// re-deriving it here.

import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { type MatchSummary, formatDuration, formatKda } from "@vyoh/shared";

type Props = {
  match: MatchSummary;
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

export function CommandPalettePreviewMatch({ match }: Props) {
  const championName = useChampionName();
  const kdaRatio =
    match.deaths === 0
      ? match.kills + match.assists
      : (match.kills + match.assists) / match.deaths;

  return (
    <aside
      data-testid="command-palette-preview"
      data-preview-type="match"
      aria-hidden
      className="pointer-events-none flex w-64 flex-col gap-2 rounded-md border bg-popover/85 px-3 py-3 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <ChampionSquareIcon
          championName={match.champion}
          className="size-12 shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {championName(match.champion)}
            </span>
            <span
              data-testid="match-outcome"
              className={
                match.win
                  ? "rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300"
                  : "rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-rose-300"
              }
            >
              {match.win ? "Win" : "Loss"}
            </span>
          </div>
          <div className="text-muted-foreground">{match.queueType}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        <span className="tabular-nums text-foreground">
          {match.kills}/{match.deaths}/{match.assists}
        </span>
        <span className="tabular-nums">{formatKda(kdaRatio)} KDA</span>
        <span className="tabular-nums">{formatDuration(match.durationSec)}</span>
        <span>{relativeTime(match.playedAt)}</span>
      </div>
    </aside>
  );
}
