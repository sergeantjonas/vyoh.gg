// Champion preview content for the command-palette anchor overlay
// (Chunk 3 vertical slice of anchor-positioned-overlays.md). Reads from
// `useChampions()` — already mounted in the dialog for filtering — so the
// preview doesn't introduce a new fetch. Falls back to `null` while champion
// data loads or for an unknown alias; the dispatcher upstream handles that
// by rendering no preview at all.

import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { useChampionInfo, useChampionName } from "@/lol/champions/use-champions";

type Props = {
  alias: string;
};

export function CommandPalettePreviewChampion({ alias }: Props) {
  const info = useChampionInfo(alias);
  const championName = useChampionName();
  if (!info) return null;

  const tags = [...info.roles, ...info.modernClasses];

  return (
    <aside
      data-testid="command-palette-preview"
      data-preview-type="champion"
      aria-hidden
      className="palette-preview pointer-events-none z-50 hidden w-64 flex-col gap-2 rounded-md border bg-popover/85 px-3 py-3 text-xs text-popover-foreground shadow-xl backdrop-blur-md md:flex"
    >
      <div className="flex items-start gap-3">
        <ChampionSquareIcon
          championName={info.alias}
          className="size-12 shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{championName(alias)}</div>
          {info.roles.length > 0 && (
            <div className="text-muted-foreground">{info.roles.join(" · ")}</div>
          )}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {info.modernClasses.map((cls) => (
            <span
              key={cls}
              className="rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {cls}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
