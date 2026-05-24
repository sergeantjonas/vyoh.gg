import { VirtualizerStats } from "@/components/virtualizer-stats";
import { mainScrollRef } from "@/lib/scroll-container";
import { steamAchievementIconUrl } from "@/steam/_shared/steam-image";
import { formatRowDate, groupByMonth } from "@/steam/achievements/group-by-month";
import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SteamRecentUnlock } from "@vyoh/shared";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

// Row baselines — header is the month-label strip (text + count), row is
// the icon-plus-meta card. Real sizes flow back through
// `virtualizer.measureElement` per item; the estimates just need to keep
// the initial scroll-height reservation in the right ballpark across
// breakpoints.
const ESTIMATED_HEADER_HEIGHT = 40;
const ESTIMATED_ROW_HEIGHT = 96;

// Flattened item stream: every group emits one header entry followed by
// its rows in feed order. The virtualizer keys on a single linear index,
// so a single-pass flatten is cleaner than nesting one virtualizer per
// group (which would also fight TanStack's measurement model — each
// virtualizer needs its own scroll element).
type Item =
  | { kind: "header"; label: string; count: number; key: string }
  | { kind: "row"; unlock: SteamRecentUnlock; key: string };

function flattenGroups(unlocks: SteamRecentUnlock[]): Item[] {
  const items: Item[] = [];
  for (const group of groupByMonth(unlocks)) {
    items.push({
      kind: "header",
      label: group.label,
      count: group.rows.length,
      key: `h:${group.label}`,
    });
    for (const u of group.rows) {
      items.push({ kind: "row", unlock: u, key: `r:${u.appid}:${u.apiName}` });
    }
  }
  return items;
}

export function RecentUnlocksVirtual({ unlocks }: { unlocks: SteamRecentUnlock[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const items = useMemo(() => flattenGroups(unlocks), [unlocks]);

  // Same scrollMargin pattern as the other library virtualizers — the
  // feed sits below the page title + meta line, and `mainScrollRef` is
  // the scroll element, so the virtualizer needs to know how far the
  // list's top edge sits below the scroll container's top.
  useLayoutEffect(() => {
    const container = mainScrollRef.current;
    if (parentRef.current && container) {
      const parentRect = parentRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setScrollMargin(parentRect.top - containerRect.top + container.scrollTop);
    }
  }, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    estimateSize: (index) =>
      items[index]?.kind === "header" ? ESTIMATED_HEADER_HEIGHT : ESTIMATED_ROW_HEIGHT,
    scrollMargin,
    overscan: 6,
    getScrollElement: () => mainScrollRef.current,
  });

  const visible = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
    >
      <VirtualizerStats rendered={visible.length} total={items.length} />
      {visible.map((virtualRow) => {
        const item = items[virtualRow.index];
        if (!item) return null;
        const style = {
          position: "absolute" as const,
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${virtualRow.start - scrollMargin}px)`,
        };
        if (item.kind === "header") {
          return (
            <div
              key={item.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={style}
            >
              <h2 className="pt-2 pb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
                <span className="ml-2 font-normal tabular-nums text-muted-foreground/60">
                  {item.count}
                </span>
              </h2>
            </div>
          );
        }
        const u = item.unlock;
        return (
          <div
            key={item.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={style}
          >
            <Link
              to="/steam/game/$appid"
              params={{ appid: String(u.appid) }}
              search={{ ach: u.apiName }}
              className="mb-2 flex items-center gap-4 rounded-lg border border-border/40 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card/80"
            >
              <img
                src={steamAchievementIconUrl(u.appid, u.apiName)}
                alt=""
                loading="lazy"
                className="size-16 shrink-0 rounded-md"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-base font-medium text-foreground/90">
                  {u.displayName}
                </p>
                <p className="truncate text-sm text-muted-foreground">{u.gameName}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
                {formatRowDate(u.unlockedAt)}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
