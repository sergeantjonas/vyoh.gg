import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { ROLE_LABEL, type RolePosition } from "@/lol/_shared/role-icon";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const MAX_NAMES_IN_VERDICT = 2;
const MAX_ICONS_IN_EVIDENCE = 6;

export interface ChampionDriftEntry {
  champion: string;
  count: number;
}

export interface PoolDrift {
  currentGames: number;
  priorGames: number;
  added: ChampionDriftEntry[];
  dropped: ChampionDriftEntry[];
  sustained: ChampionDriftEntry[];
}

export function computePoolDrift(
  matches: MatchSummary[],
  now: number,
  windowDays = WINDOW_DAYS
): PoolDrift {
  const currentCutoff = now - windowDays * MS_PER_DAY;
  const priorCutoff = now - windowDays * 2 * MS_PER_DAY;

  const currentCounts = new Map<string, number>();
  const priorCounts = new Map<string, number>();

  for (const m of matches) {
    if (m.remake) continue;
    const t = new Date(m.playedAt).getTime();
    if (t >= currentCutoff && t <= now) {
      currentCounts.set(m.champion, (currentCounts.get(m.champion) ?? 0) + 1);
    } else if (t >= priorCutoff && t < currentCutoff) {
      priorCounts.set(m.champion, (priorCounts.get(m.champion) ?? 0) + 1);
    }
  }

  const added: ChampionDriftEntry[] = [];
  const sustained: ChampionDriftEntry[] = [];
  for (const [champion, count] of currentCounts) {
    if (priorCounts.has(champion)) sustained.push({ champion, count });
    else added.push({ champion, count });
  }
  const dropped: ChampionDriftEntry[] = [];
  for (const [champion, count] of priorCounts) {
    if (!currentCounts.has(champion)) dropped.push({ champion, count });
  }

  const byCountDesc = (a: ChampionDriftEntry, b: ChampionDriftEntry) =>
    b.count - a.count || a.champion.localeCompare(b.champion);
  added.sort(byCountDesc);
  dropped.sort(byCountDesc);
  sustained.sort(byCountDesc);

  let currentGames = 0;
  for (const c of currentCounts.values()) currentGames += c;
  let priorGames = 0;
  for (const c of priorCounts.values()) priorGames += c;

  return { currentGames, priorGames, added, dropped, sustained };
}

function joinNames(entries: ChampionDriftEntry[]): string {
  const names = entries.slice(0, MAX_NAMES_IN_VERDICT).map((e) => e.champion);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0] ?? "";
  return `${names[0]} & ${names[1]}`;
}

function verdictFor(drift: PoolDrift): { text: string; empty: boolean } {
  const { added, dropped, sustained, currentGames, priorGames } = drift;
  if (currentGames === 0) {
    return { text: "No games in the last 14 days.", empty: true };
  }
  if (priorGames === 0) {
    return {
      text: `${added.length + sustained.length} champion${added.length + sustained.length !== 1 ? "s" : ""} this fortnight — no prior window to compare against yet.`,
      empty: true,
    };
  }
  if (added.length > 0 && dropped.length > 0) {
    return {
      text: `Picked up ${joinNames(added)} this fortnight; cooled on ${joinNames(dropped)}.`,
      empty: false,
    };
  }
  if (added.length > 0) {
    return {
      text: `New this fortnight: ${joinNames(added)}. Pool widening.`,
      empty: false,
    };
  }
  if (dropped.length > 0) {
    return {
      text: `Cooled on ${joinNames(dropped)}; otherwise same pool as last fortnight.`,
      empty: false,
    };
  }
  return {
    text: `Same ${sustained.length} champion${sustained.length !== 1 ? "s" : ""} as last fortnight.`,
    empty: false,
  };
}

function DriftStrip({
  label,
  entries,
  tone,
}: {
  label: string;
  entries: ChampionDriftEntry[];
  tone: "added" | "dropped";
}) {
  if (entries.length === 0) return null;
  const display = entries.slice(0, MAX_ICONS_IN_EVIDENCE);
  const overflow = entries.length - display.length;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 uppercase tracking-wide text-muted-foreground/70 text-[10px]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {display.map((e) => (
          <span key={e.champion} className="inline-flex items-center gap-1">
            <ChampionSquareIcon
              championName={e.champion}
              className={
                tone === "added"
                  ? "size-5 rounded-sm ring-1 ring-emerald-500/40"
                  : "size-5 rounded-sm opacity-60"
              }
            />
            <span className="tabular-nums text-muted-foreground/80">{e.count}</span>
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-muted-foreground/60">+{overflow}</span>
        )}
      </div>
    </div>
  );
}

export function ChampionPoolDrift({
  matches,
  now,
  role,
}: {
  matches: MatchSummary[];
  now?: number;
  role?: RolePosition;
}) {
  // The route already pre-filters by role, but accept the same filter here
  // so the card stays self-contained when reused from a page that hands it
  // the raw match window.
  const scoped = useMemo(
    () => (role ? matches.filter((m) => m.teamPosition === role) : matches),
    [matches, role]
  );
  const drift = useMemo(() => computePoolDrift(scoped, now ?? Date.now()), [scoped, now]);
  const { text, empty } = verdictFor(drift);

  const hasEvidence = drift.added.length > 0 || drift.dropped.length > 0;
  const title = role ? `Your ${ROLE_LABEL[role]} pool drift` : "Champion pool drift";

  return (
    <ConclusionCard
      title={title}
      sampleSize={drift.currentGames}
      verdict={text}
      empty={empty}
      evidence={
        hasEvidence ? (
          <div className="flex flex-col gap-1.5">
            <DriftStrip label="Added" entries={drift.added} tone="added" />
            <DriftStrip label="Dropped" entries={drift.dropped} tone="dropped" />
          </div>
        ) : undefined
      }
    />
  );
}
