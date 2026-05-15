import { cn } from "@/lib/utils";
import type { SteamAchievement } from "@vyoh/shared";
import { useState } from "react";
import { useGameAchievements } from "./use-game-achievements";

// Default visible rows before the "Show all" affordance. Stardew ~50, Hades 49,
// the largest in the current library trip ~100; 12 is enough to surface the
// most-recent unlocks (server-sorted unlocked-first) without dwarfing the
// surrounding playtime card.
const PREVIEW_COUNT = 12;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatUnlockedDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

interface AchievementPanelProps {
  appid: number;
}

export function AchievementPanel({ appid }: AchievementPanelProps) {
  const { data, isPending, isError } = useGameAchievements(appid);
  const [expanded, setExpanded] = useState(false);
  // Per-row reveal state for hidden+locked rows. Steam's Web API returns the
  // real `displayName` for hidden achievements but blanks the `description`
  // — so clicking peeks at the name (and the actual icon, via iconUrl), but
  // there's no description text to reveal: the server genuinely doesn't
  // have it. Toggle: click again to re-mask.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const toggleReveal = (apiName: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(apiName)) next.delete(apiName);
      else next.add(apiName);
      return next;
    });
  };

  if (isPending) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">Achievements are unavailable right now.</p>
    );
  }

  // No schema → game is achievement-less (CS2, demos). Hide the section.
  if (!data || data.achievements === null) return null;

  // Schema exists but no rows yet — first-deploy edge case for a freshly-
  // added game before the schema poller has caught it.
  if (data.achievements.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Achievements
        </h2>
        <p className="text-sm text-muted-foreground">
          Schema is in flight. Unlocks land with the next sync.
        </p>
      </section>
    );
  }

  const total = data.achievements.length;
  const unlocked = data.achievements.filter((a) => a.unlockedAt !== null).length;
  const visible = expanded
    ? data.achievements
    : data.achievements.slice(0, PREVIEW_COUNT);
  const remaining = total - PREVIEW_COUNT;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Achievements
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {unlocked} / {total} unlocked
        </p>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2">
        {visible.map((ach) => (
          <AchievementRow
            key={ach.apiName}
            achievement={ach}
            isRevealed={revealed.has(ach.apiName)}
            onToggleReveal={() => toggleReveal(ach.apiName)}
          />
        ))}
      </ul>
      {!expanded && total > PREVIEW_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Show {remaining} more
        </button>
      )}
    </section>
  );
}

interface AchievementRowProps {
  achievement: SteamAchievement;
  isRevealed: boolean;
  onToggleReveal: () => void;
}

function AchievementRow({
  achievement: a,
  isRevealed,
  onToggleReveal,
}: AchievementRowProps) {
  const unlocked = a.unlockedAt !== null;
  // Only hidden+locked rows can be revealed. Once unlocked, the name +
  // colored icon are already shown (matches Steam client behavior); locked
  // non-hidden rows weren't masked to begin with. Description text is never
  // revealable — Steam's Web API doesn't expose hidden descriptions, even
  // for the owner's unlocked rows.
  const canReveal = a.hidden && !unlocked;
  const masked = canReveal && !isRevealed;

  const inner = (
    <>
      <img
        src={unlocked ? a.iconUrl : a.iconGrayUrl}
        alt=""
        loading="lazy"
        className={cn("size-10 shrink-0 rounded", !unlocked && "opacity-70")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm font-medium",
              unlocked ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {masked ? "???" : a.displayName}
          </p>
          {a.globalPercent !== null && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
              {a.globalPercent.toFixed(1)}%
            </span>
          )}
        </div>
        {(masked || a.description !== "") && (
          <p
            className={cn(
              "line-clamp-2 text-xs leading-snug",
              unlocked ? "text-muted-foreground" : "text-muted-foreground/60"
            )}
          >
            {masked ? "Hidden — click to reveal name" : a.description}
          </p>
        )}
        {unlocked && a.unlockedAt !== null && (
          <p className="text-[10px] tabular-nums text-muted-foreground/60">
            Unlocked {formatUnlockedDate(a.unlockedAt)}
          </p>
        )}
      </div>
    </>
  );

  // Strong unlocked/locked differentiation — was uniform before, which made
  // glance-readability poor on long lists. Unlocked rows get a normal card
  // background + emerald border accent on the left; locked rows recede via
  // opacity + thinner border. Revealable rows surface a cursor + hover.
  const className = cn(
    "flex w-full items-start gap-3 rounded-md border p-2.5 text-left transition-colors",
    unlocked
      ? "border-border/60 border-l-2 border-l-emerald-500/50 bg-card/80"
      : "border-border/20 bg-background/20 opacity-65",
    canReveal && "cursor-pointer hover:bg-background/40 hover:opacity-90"
  );

  if (canReveal) {
    return (
      <li>
        <button type="button" onClick={onToggleReveal} className={className}>
          {inner}
        </button>
      </li>
    );
  }

  return <li className={className}>{inner}</li>;
}
