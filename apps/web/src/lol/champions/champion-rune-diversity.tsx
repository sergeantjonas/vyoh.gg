import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { usePerks } from "@/lol/_shared/analytics/use-perks";
import { KeystoneIcon } from "@/lol/_shared/assets/keystone-icon";
import { ConclusionCard } from "@/lol/_shared/ui/conclusion-card";
import { type WrAccent, wrAccent } from "@/lol/_shared/wr-accent";
import { useChampionRuneDiversity } from "@/lol/champions/use-champion-rune-diversity";
import type { ChampionRuneDiversityEntry } from "@vyoh/shared";

// Total games on the champion needed before the tile is worth rendering — mirrors
// ChampionBuildPath so the two champion-detail tiles gate on the same sample floor.
const MIN_ENTRIES = 5;
// Per-keystone floor below which we don't colour the win rate or show a lift arrow:
// a 1–2 game keystone WR is noise, so it renders neutral.
const MIN_WR_GAMES = 3;
// Lift vs the champion's overall WR before the row earns an up/down marker.
const LIFT_THRESHOLD = 0.05;

const NEUTRAL_ACCENT: WrAccent = {
  text: "text-muted-foreground",
  bar: "bg-muted-foreground/40",
  rail: "bg-muted-foreground/10",
  rowBorder: "border-l-muted-foreground/20",
};

function KeystoneRow({
  entry,
  name,
  baselineWR,
}: {
  entry: ChampionRuneDiversityEntry;
  name: string;
  baselineWR: number;
}) {
  const wr = entry.games > 0 ? entry.wins / entry.games : 0;
  const confident = entry.games >= MIN_WR_GAMES;
  const accent = confident ? wrAccent(wr) : NEUTRAL_ACCENT;
  const lift = wr - baselineWR;
  const marker = !confident
    ? null
    : lift > LIFT_THRESHOLD
      ? { glyph: "▲", className: "text-emerald-400" }
      : lift < -LIFT_THRESHOLD
        ? { glyph: "▼", className: "text-rose-400" }
        : { glyph: "·", className: "text-muted-foreground/60" };

  return (
    <div
      className={cn("flex items-center gap-2.5 border-l-2 py-1 pl-2", accent.rowBorder)}
    >
      <KeystoneIcon id={entry.keystoneId} className="size-5" />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">{name}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
        {entry.games}
        {entry.games === 1 ? " game" : " games"}
      </span>
      <div
        className={cn("h-1.5 w-16 shrink-0 overflow-hidden rounded-full", accent.rail)}
      >
        <div
          className={cn("h-full rounded-full", accent.bar)}
          style={{ width: `${Math.round(wr * 100)}%` }}
        />
      </div>
      <span className={cn("w-9 shrink-0 text-right text-xs tabular-nums", accent.text)}>
        {Math.round(wr * 100)}%
      </span>
      <span className={cn("w-3 shrink-0 text-center text-[10px]", marker?.className)}>
        {marker?.glyph ?? ""}
      </span>
    </div>
  );
}

export function ChampionRuneDiversity({
  accountSlug,
  championKey,
  frosted = true,
}: {
  accountSlug: string;
  championKey: string;
  /** Frosted recipe (`bg-card/60 + backdrop-blur-sm`). Defaults to true — the
   *  champion-detail panel sits over a splash backdrop. See "one level of glass"
   *  in repo-conventions. */
  frosted?: boolean;
}) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useChampionRuneDiversity(account, championKey);
  const perks = usePerks();

  if (isPending || !data) return null;

  const totalGames = data.reduce((sum, e) => sum + e.games, 0);

  if (data.length === 0 || totalGames < MIN_ENTRIES) {
    return (
      <ConclusionCard
        title="Rune diversity"
        sampleSize={totalGames}
        verdict={`Need ${MIN_ENTRIES}+ games on this champion to chart which keystones you run.`}
        empty
        frosted={frosted}
      />
    );
  }

  const baselineWR = data.reduce((sum, e) => sum + e.wins, 0) / totalGames;
  const nameFor = (id: number) => perks?.get(id)?.name ?? `Rune ${id}`;

  const top = data[0];
  let verdict: string;
  if (data.length === 1 && top) {
    verdict = `You've run ${nameFor(top.keystoneId)} on every one of your ${totalGames} games on this champion.`;
  } else if (top && top.games / totalGames >= 0.6) {
    verdict = `You lean on ${nameFor(top.keystoneId)} — ${top.games} of ${totalGames} games (${data.length} keystones tried).`;
  } else {
    verdict = `You spread across ${data.length} keystones over ${totalGames} games — no single page dominates.`;
  }

  return (
    <ConclusionCard
      title="Rune diversity"
      sampleSize={totalGames}
      verdict={verdict}
      verdictMarkdown={verdict}
      frosted={frosted}
      evidence={
        <div className="flex flex-col gap-1">
          {data.map((entry) => (
            <KeystoneRow
              key={entry.keystoneId}
              entry={entry}
              name={nameFor(entry.keystoneId)}
              baselineWR={baselineWR}
            />
          ))}
        </div>
      }
    />
  );
}
