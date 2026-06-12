// Baseline: personal — per-patch WR from your own games; surfaces the best and worst patch with min-sample.
import { ChapterLabel } from "@/components/ui/chapter-label";
import { groupByPatch } from "@/lol/_shared/patch/patch-version";
import { ChapterShell } from "@/lol/recap/chapter-shell";
import { type MatchSummary, excludeRemakes, formatPercent } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_GAMES_PER_PATCH = 5;

interface PatchVerdict {
  best: { patch: string; games: number; wr: number };
  worst: { patch: string; games: number; wr: number };
}

function computePatchVerdict(matches: MatchSummary[]): PatchVerdict | null {
  const valid = excludeRemakes(matches);
  const buckets = groupByPatch(valid, (m) => m.gameVersion).filter(
    (b) => b.items.length >= MIN_GAMES_PER_PATCH
  );
  if (buckets.length < 2) return null;
  const stats = buckets.map((b) => ({
    patch: b.patch,
    games: b.items.length,
    wr: b.items.filter((m) => m.win).length / b.items.length,
  }));
  // Sort by WR ascending so the worst is first and the best is last. Stable
  // tie-break keeps later patches as the "best" when WR ties — recent form
  // reads more usefully than older.
  stats.sort((a, b) => a.wr - b.wr);
  const worst = stats[0];
  const best = stats[stats.length - 1];
  if (!worst || !best || worst.patch === best.patch) return null;
  return { best, worst };
}

export function RecapPatchVerdict({ matches }: { matches: MatchSummary[] | undefined }) {
  const verdict = useMemo(
    () => (matches ? computePatchVerdict(matches) : null),
    [matches]
  );

  if (!verdict) {
    return (
      <ChapterShell>
        <ChapterLabel>Best and worst patch</ChapterLabel>
        <p className="text-base text-muted-foreground">
          Once you've played at least 5 games on two or more patches, the best and worst
          patches land here.
        </p>
      </ChapterShell>
    );
  }

  return (
    <ChapterShell populated>
      <ChapterLabel>Best and worst patch</ChapterLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <PatchTile
          label="Best patch"
          patch={verdict.best.patch}
          wr={formatPercent(verdict.best.wr)}
          games={verdict.best.games}
          tone="up"
        />
        <PatchTile
          label="Worst patch"
          patch={verdict.worst.patch}
          wr={formatPercent(verdict.worst.wr)}
          games={verdict.worst.games}
          tone="down"
        />
      </div>
    </ChapterShell>
  );
}

function PatchTile({
  label,
  patch,
  wr,
  games,
  tone,
}: {
  label: string;
  patch: string;
  wr: string;
  games: number;
  tone: "up" | "down";
}) {
  const accent = tone === "up" ? "text-emerald-500/90" : "text-rose-500/90";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground/90">
          {patch}
        </span>
        <span className={`text-base font-medium tabular-nums ${accent}`}>{wr}</span>
      </div>
      <div className="text-xs text-muted-foreground/70">{games} games</div>
    </div>
  );
}
