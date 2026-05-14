// Baseline: personal — per-patch WR from your own games; surfaces the best and worst patch with min-sample.
import { groupByPatch } from "@/lol/_shared/patch/patch-version";
import type { MatchSummary } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { useMemo } from "react";

const MIN_GAMES_PER_PATCH = 5;

interface PatchVerdict {
  best: { patch: string; games: number; wr: number };
  worst: { patch: string; games: number; wr: number };
}

function computePatchVerdict(matches: MatchSummary[]): PatchVerdict | null {
  const valid = matches.filter((m) => !m.remake);
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
  const reduced = useReducedMotion();
  const verdict = useMemo(
    () => (matches ? computePatchVerdict(matches) : null),
    [matches]
  );

  if (!verdict) {
    return (
      <m.section
        layout
        initial={reduced ? false : { opacity: 0, y: 16 }}
        whileInView={reduced ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col gap-3 rounded-xl border bg-card/40 p-6"
      >
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
          Best and worst patch
        </h2>
        <p className="text-base text-muted-foreground">
          Once you've played at least 5 games on two or more patches, the best and worst
          patches land here.
        </p>
      </m.section>
    );
  }

  const bestPct = Math.round(verdict.best.wr * 100);
  const worstPct = Math.round(verdict.worst.wr * 100);

  return (
    <m.section
      layout
      initial={reduced ? false : { opacity: 0, y: 32 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-col gap-4 rounded-xl border bg-card/40 p-6 sm:p-8"
    >
      <h2 className="text-xs uppercase tracking-wide text-muted-foreground/70">
        Best and worst patch
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <PatchTile
          label="Best patch"
          patch={verdict.best.patch}
          wr={bestPct}
          games={verdict.best.games}
          tone="up"
        />
        <PatchTile
          label="Worst patch"
          patch={verdict.worst.patch}
          wr={worstPct}
          games={verdict.worst.games}
          tone="down"
        />
      </div>
    </m.section>
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
  wr: number;
  games: number;
  tone: "up" | "down";
}) {
  const accent = tone === "up" ? "text-emerald-500/90" : "text-rose-500/90";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-foreground/90">
          {patch}
        </span>
        <span className={`text-base font-medium tabular-nums ${accent}`}>{wr}%</span>
      </div>
      <div className="text-xs text-muted-foreground/70">{games} games</div>
    </div>
  );
}
