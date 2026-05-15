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
          <AchievementRow key={ach.apiName} achievement={ach} />
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
}

function AchievementRow({ achievement: a }: AchievementRowProps) {
  const unlocked = a.unlockedAt !== null;
  // Spoiler masking — only applies while locked. Once unlocked, the spoiler
  // is moot and Steam's own client reveals the name + icon fully, so we
  // match that behavior. The server returned the real `displayName` and
  // `description` regardless; the mask is a render-time decision here.
  const masked = a.hidden && !unlocked;

  return (
    <li className="flex gap-3 rounded-md border border-border/40 bg-background/40 p-2.5">
      <img
        src={unlocked ? a.iconUrl : a.iconGrayUrl}
        alt=""
        loading="lazy"
        className={cn("size-10 shrink-0 rounded", !unlocked && "opacity-60")}
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
        <p
          className={cn(
            "line-clamp-2 text-xs leading-snug",
            unlocked ? "text-muted-foreground" : "text-muted-foreground/60"
          )}
        >
          {masked ? "Hidden achievement" : a.description || "—"}
        </p>
        {unlocked && a.unlockedAt !== null && (
          <p className="text-[10px] tabular-nums text-muted-foreground/60">
            Unlocked {formatUnlockedDate(a.unlockedAt)}
          </p>
        )}
      </div>
    </li>
  );
}
