import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSteamTags } from "@/steam/use-tags";
import type { SteamOwnedGame } from "@vyoh/shared";
import { Tag, X } from "lucide-react";
import { useMemo, useState } from "react";

// Floor: surface only tags that show up on at least this many owned titles.
// Picked low enough to keep genre-shaped tags ("Roguelike", "Co-op") visible
// across a ~200-game library while filtering out noise from the long tail
// (curator-style tags that hit one game and clutter the popover).
const MIN_TAG_FREQUENCY = 3;

interface TagFilterPopoverProps {
  games: SteamOwnedGame[];
  selectedTagIds: number[];
  onChange: (next: number[]) => void;
}

export function TagFilterPopover({
  games,
  selectedTagIds,
  onChange,
}: TagFilterPopoverProps) {
  const { data: catalog, isPending, isError } = useSteamTags();
  const [query, setQuery] = useState("");

  // Derive { id, name, count } from owned games. Frequency is the count of
  // currently-loaded games carrying the tag; floor filters out the long tail.
  // Selected tags are kept even if they fall under the floor so a user who
  // ticked an obscure tag still sees it ticked when reopening the popover.
  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const options = useMemo(() => {
    if (!catalog) return [];
    const counts = new Map<number, number>();
    for (const g of games) {
      for (const tid of g.tagIds) {
        counts.set(tid, (counts.get(tid) ?? 0) + 1);
      }
    }
    const labelById = new Map(catalog.tags.map((t) => [t.id, t.name]));
    const list: Array<{ id: number; name: string; count: number }> = [];
    for (const [id, count] of counts) {
      if (count < MIN_TAG_FREQUENCY && !selectedSet.has(id)) continue;
      const name = labelById.get(id);
      if (!name) continue;
      list.push({ id, name, count });
    }
    // Sort by selection-first (so checked items stay anchored on top while
    // the user types), then count desc, then name for stability.
    list.sort((a, b) => {
      const aSel = selectedSet.has(a.id) ? 1 : 0;
      const bSel = selectedSet.has(b.id) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      if (a.count !== b.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    });
    return list;
  }, [games, catalog, selectedSet]);

  const q = query.trim().toLowerCase();
  const visible =
    q === "" ? options : options.filter((o) => o.name.toLowerCase().includes(q));

  const toggle = (id: number) => {
    if (selectedSet.has(id)) {
      onChange(selectedTagIds.filter((x) => x !== id));
    } else {
      onChange([...selectedTagIds, id]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tag className="size-3.5" />
          Tags
          {selectedTagIds.length > 0 && (
            <span className="rounded-sm bg-primary px-1.5 text-xs font-medium text-primary-foreground tabular-nums">
              {selectedTagIds.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center gap-2 border-b p-2">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tags…"
            className="h-8"
            aria-label="Search tags"
          />
          {selectedTagIds.length > 0 && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Clear tag selection"
              onClick={() => onChange([])}
            >
              <X />
            </Button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {isPending && (
            <p className="px-3 py-4 text-xs text-muted-foreground">Loading tags…</p>
          )}
          {isError && (
            <p className="px-3 py-4 text-xs text-destructive">Tag catalog unavailable.</p>
          )}
          {!isPending && !isError && visible.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              {q === "" ? "No tags reach the frequency floor yet." : "No matches."}
            </p>
          )}
          {visible.map((opt) => {
            const checked = selectedSet.has(opt.id);
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => toggle(opt.id)}
                aria-pressed={checked}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                />
                <span className="min-w-0 flex-1 truncate">{opt.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
