import { cn } from "@/lib/utils";
import { RarityPercent } from "@/steam/_shared/rarity-percent";
import type { SteamAchievement } from "@vyoh/shared";
import { useEffect, useRef, useState } from "react";
import { useGameAchievements } from "./use-game-achievements";

// Default visible rows before the "Show all" affordance. Stardew ~50, Hades 49,
// the largest in the current library trip ~100; 12 is enough to surface the
// most-recent unlocks (server-sorted unlocked-first) without dwarfing the
// surrounding playtime card.
const PREVIEW_COUNT = 12;

// Search bar only renders when a game has at least this many achievements —
// for small lists the input is chrome that costs more than it saves.
const SEARCH_THRESHOLD = 30;

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
  highlightTarget?: string;
}

export function AchievementPanel({ appid, highlightTarget }: AchievementPanelProps) {
  const { data, isPending, isError } = useGameAchievements(appid);
  const [expanded, setExpanded] = useState(false);
  // Per-row reveal state for hidden+locked rows. Steam's Web API returns the
  // real `displayName` for hidden achievements but blanks the `description`
  // — so clicking peeks at the name (and the actual icon, via iconUrl), but
  // there's no description text to reveal: the server genuinely doesn't
  // have it. Toggle: click again to re-mask.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [lockedOnly, setLockedOnly] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const toggleReveal = (apiName: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(apiName)) next.delete(apiName);
      else next.add(apiName);
      return next;
    });
  };

  // Deep-link from the profile chip lands here with ?ach=<apiName>. Make sure
  // the target is visible (clear search, force expand, flip lockedOnly off if
  // the target is unlocked) before kicking off the scroll-and-highlight pass.
  useEffect(() => {
    if (!highlightTarget || !data?.achievements) return;
    const target = data.achievements.find((a) => a.apiName === highlightTarget);
    if (!target) return;
    if (target.unlockedAt !== null) setLockedOnly(false);
    setQuery("");
    setExpanded(true);
    setHighlighted(highlightTarget);
  }, [highlightTarget, data]);

  // Scroll the highlighted row into view on the next frame so it's mounted,
  // then fade the ring after a short beat.
  useEffect(() => {
    if (!highlighted || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-ach-id="${CSS.escape(highlighted)}"]`
    );
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timeout = window.setTimeout(() => setHighlighted(null), 2500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [highlighted]);

  if (isPending) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/50" />
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
  const showSearch = total >= SEARCH_THRESHOLD;
  // Filter on lowercase substring match against displayName + description.
  // Hidden+locked rows match on their real `displayName` (Steam reveals it
  // via the schema endpoint regardless of hidden flag), so the search will
  // find a row even if the user hasn't clicked-to-reveal it yet — they can
  // still find by description if they remember it. Locked rows that match
  // stay masked visually; the search doesn't auto-reveal.
  const normalized = query.trim().toLowerCase();
  const searchFiltered =
    normalized === ""
      ? data.achievements
      : data.achievements.filter(
          (a) =>
            a.displayName.toLowerCase().includes(normalized) ||
            a.description.toLowerCase().includes(normalized)
        );
  const filtered = lockedOnly
    ? searchFiltered.filter((a) => a.unlockedAt === null)
    : searchFiltered;
  // Preview truncation only applies when no narrowing affordance is engaged —
  // once the user searches or flips lockedOnly, show every hit.
  const truncate = !expanded && normalized === "" && !lockedOnly;
  const visible = truncate ? filtered.slice(0, PREVIEW_COUNT) : filtered;
  const remaining = filtered.length - PREVIEW_COUNT;

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
      {(showSearch || unlocked < total) && (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${total} achievements…`}
              className="min-w-0 flex-1 rounded-md border border-border/40 bg-background/40 px-3 py-1.5 text-sm placeholder:text-muted-foreground/60 focus:border-border focus:outline-none"
            />
          )}
          {unlocked < total && (
            <button
              type="button"
              aria-pressed={lockedOnly}
              onClick={() => setLockedOnly((v) => !v)}
              className={cn(
                "shrink-0 rounded-md border px-3 py-1.5 text-sm transition-colors",
                lockedOnly
                  ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                  : "border-border/40 bg-background/40 text-muted-foreground hover:text-foreground"
              )}
            >
              Locked only · {total - unlocked}
            </button>
          )}
        </div>
      )}
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {lockedOnly && normalized === ""
            ? "All achievements unlocked."
            : `No achievements match "${query}".`}
        </p>
      )}
      <ul ref={listRef} className="flex flex-col gap-2">
        {visible.map((ach) => (
          <AchievementRow
            key={ach.apiName}
            achievement={ach}
            isRevealed={revealed.has(ach.apiName)}
            onToggleReveal={() => toggleReveal(ach.apiName)}
            isHighlighted={highlighted === ach.apiName}
          />
        ))}
      </ul>
      {!expanded && normalized === "" && !lockedOnly && total > PREVIEW_COUNT && (
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
  isHighlighted: boolean;
}

function AchievementRow({
  achievement: a,
  isRevealed,
  onToggleReveal,
  isHighlighted,
}: AchievementRowProps) {
  const unlocked = a.unlockedAt !== null;
  // Only hidden+locked rows can be revealed. Once unlocked, the name +
  // colored icon are already shown (matches Steam client behavior); locked
  // non-hidden rows weren't masked to begin with. Description text is never
  // revealable — Steam's Web API doesn't expose hidden descriptions, even
  // for the owner's unlocked rows.
  const canReveal = a.hidden && !unlocked;
  const masked = canReveal && !isRevealed;

  // Rare-treatment tiers. Steam's own client highlights very-rare achievements
  // distinctly; on a dense grid this is the readability difference between
  // "row 23 of 87" and "wait, that's a 0.4% unlock". Only applied to *unlocked*
  // rows — locked-rare is a goal, not a flex, and shouldn't compete visually.
  const isVeryRare = unlocked && a.globalPercent !== null && a.globalPercent < 1;
  const isRare =
    unlocked && a.globalPercent !== null && a.globalPercent < 5 && !isVeryRare;

  const inner = (
    <>
      <img
        src={unlocked ? a.iconUrl : a.iconGrayUrl}
        alt=""
        loading="lazy"
        className={cn("size-16 shrink-0 rounded-md", !unlocked && "opacity-70")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "truncate text-base font-medium",
              unlocked ? "text-foreground" : "text-muted-foreground",
              isVeryRare && "text-amber-300",
              isRare && "text-amber-200"
            )}
          >
            {isVeryRare && (
              <span aria-hidden className="mr-1 text-amber-300">
                ★
              </span>
            )}
            {masked ? "???" : a.displayName}
          </p>
          {a.globalPercent !== null && (
            <RarityPercent
              percent={a.globalPercent}
              prefix={isVeryRare ? "Very rare · " : isRare ? "Rare · " : undefined}
              className={cn(
                "shrink-0 text-xs",
                isVeryRare
                  ? "font-semibold text-amber-300 decoration-amber-300/40"
                  : isRare
                    ? "font-semibold text-amber-200 decoration-amber-200/40"
                    : "text-muted-foreground/70"
              )}
            />
          )}
        </div>
        {(masked || a.description !== "") && (
          <p
            className={cn(
              "line-clamp-2 text-sm leading-snug",
              unlocked ? "text-muted-foreground" : "text-muted-foreground/60"
            )}
          >
            {masked ? "Hidden — click to reveal name" : a.description}
          </p>
        )}
        {unlocked && a.unlockedAt !== null && (
          <p className="text-xs tabular-nums text-muted-foreground/60">
            Unlocked {formatUnlockedDate(a.unlockedAt)}
          </p>
        )}
      </div>
    </>
  );

  // Strong unlocked/locked differentiation + rare-tier highlight. Unlocked
  // rows get a normal card background; locked rows recede via opacity +
  // thinner border. Rare overrides the left accent from emerald → amber and
  // adds a subtle amber wash; very-rare cranks the wash + a glow ring so
  // a single 0.5% unlock visibly pops out of a dense grid.
  const className = cn(
    "flex w-full items-start gap-4 rounded-lg border p-4 text-left transition",
    unlocked
      ? cn(
          "border-l-2 bg-card/80",
          isVeryRare
            ? "border-amber-300/60 border-l-amber-300 bg-amber-500/10 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.25)]"
            : isRare
              ? "border-amber-400/40 border-l-amber-400/70 bg-amber-500/[0.06]"
              : "border-border/60 border-l-emerald-500/50"
        )
      : "border-border/20 bg-background/20 opacity-65",
    canReveal && "cursor-pointer hover:bg-background/40 hover:opacity-90",
    isHighlighted && "ring-2 ring-amber-300 ring-offset-2 ring-offset-background"
  );

  if (canReveal) {
    return (
      <li data-ach-id={a.apiName}>
        <button type="button" onClick={onToggleReveal} className={className}>
          {inner}
        </button>
      </li>
    );
  }

  return (
    <li data-ach-id={a.apiName} className={className}>
      {inner}
    </li>
  );
}
