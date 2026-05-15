import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, List, Search } from "lucide-react";
import type {
  LibraryAppTypeFilter,
  LibraryLayout,
  LibraryPlayedFilter,
  LibrarySort,
} from "./use-library-prefs";

interface LibraryControlsProps {
  query: string;
  onQueryChange: (next: string) => void;
  sort: LibrarySort;
  onSortChange: (next: LibrarySort) => void;
  playedFilter: LibraryPlayedFilter;
  onPlayedFilterChange: (next: LibraryPlayedFilter) => void;
  appTypeFilter: LibraryAppTypeFilter;
  onAppTypeFilterChange: (next: LibraryAppTypeFilter) => void;
  layout: LibraryLayout;
  onLayoutChange: (next: LibraryLayout) => void;
  totalCount: number;
  visibleCount: number;
}

export function LibraryControls({
  query,
  onQueryChange,
  sort,
  onSortChange,
  playedFilter,
  onPlayedFilterChange,
  appTypeFilter,
  onAppTypeFilterChange,
  layout,
  onLayoutChange,
  totalCount,
  visibleCount,
}: LibraryControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search games…"
            className="pl-7"
            aria-label="Search library"
          />
        </div>

        <Select value={sort} onValueChange={(v) => onSortChange(v as LibrarySort)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lifetime">Lifetime playtime</SelectItem>
            <SelectItem value="twoWeeks">Last two weeks</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={playedFilter}
          onValueChange={(v) => onPlayedFilterChange(v as LibraryPlayedFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All games</SelectItem>
            <SelectItem value="played">Played</SelectItem>
            <SelectItem value="never">Never launched</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={appTypeFilter}
          onValueChange={(v) => onAppTypeFilterChange(v as LibraryAppTypeFilter)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="game">Games</SelectItem>
            <SelectItem value="app">Tools</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto inline-flex rounded-lg border border-border">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-pressed={layout === "rows"}
            aria-label="Row layout"
            onClick={() => onLayoutChange("rows")}
            className="rounded-r-none aria-pressed:bg-muted aria-pressed:text-foreground"
          >
            <List />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-pressed={layout === "tiles"}
            aria-label="Tile layout"
            onClick={() => onLayoutChange("tiles")}
            className="rounded-l-none aria-pressed:bg-muted aria-pressed:text-foreground"
          >
            <LayoutGrid />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visibleCount === totalCount
          ? `${totalCount.toLocaleString("en-US")} ${totalCount === 1 ? "game" : "games"}`
          : `${visibleCount.toLocaleString("en-US")} of ${totalCount.toLocaleString("en-US")} games`}
      </p>
    </div>
  );
}
