import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { ConclusionCard } from "@/lol/_shared/ui/conclusion-card";
import { useChampionLanePhase } from "@/lol/champions/use-champion-lane-phase";
import type { LanePhaseMetric } from "@vyoh/shared";

// Total games on the champion (with a lane opponent + 10-min frame) needed before
// the tile is worth rendering — mirrors the other champion-detail tiles.
const MIN_ENTRIES = 5;

// Signed display: "+18" / "-12" / "0". Rounded to whole CS / gold.
function fmtSigned(diff: number): string {
  const r = Math.round(diff);
  return r > 0 ? `+${r}` : String(r);
}

function LaneStatTile({
  label,
  metric,
}: {
  label: string;
  metric: LanePhaseMetric;
}) {
  const rounded = Math.round(metric.diff);
  const tone =
    rounded > 0
      ? "text-emerald-400"
      : rounded < 0
        ? "text-rose-400"
        : "text-muted-foreground";
  return (
    // Transparent recipe (bg-card/50): these tiles are nested inside the frosted
    // ConclusionCard — one level of glass (see repo-conventions).
    <div className="flex flex-col gap-1 rounded-md border bg-card/50 p-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums", tone)}>
        {fmtSigned(metric.diff)}
      </span>
      <span className="text-[10px] text-muted-foreground/60">
        ahead {Math.round(metric.aheadRate * 100)}% of games
      </span>
    </div>
  );
}

export function ChampionLanePhase({
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
  const { data, isPending } = useChampionLanePhase(account, championKey);

  if (isPending || !data) return null;

  if (data.sampleSize < MIN_ENTRIES) {
    return (
      <ConclusionCard
        title="Lane phase"
        sampleSize={data.sampleSize}
        verdict={`Need ${MIN_ENTRIES}+ games with a tracked lane opponent to chart your lane-phase edge.`}
        empty
        frosted={frosted}
      />
    );
  }

  const cs10 = Math.round(data.csAt10.diff);
  const rate10 = Math.round(data.csAt10.aheadRate * 100);
  let verdict: string;
  if (cs10 > 0) {
    verdict = `You out-farm your lane opponent by ${cs10} CS at 10 min on average — ahead in ${rate10}% of ${data.sampleSize} games.`;
  } else if (cs10 < 0) {
    verdict = `Your lane opponent out-farms you by ${-cs10} CS at 10 min on average — you're ahead in only ${rate10}% of ${data.sampleSize} games.`;
  } else {
    verdict = `You trade even at 10 min on average — ahead in ${rate10}% of ${data.sampleSize} games.`;
  }

  return (
    <ConclusionCard
      title="Lane phase"
      sampleSize={data.sampleSize}
      verdict={verdict}
      verdictMarkdown={verdict}
      frosted={frosted}
      evidence={
        <div className="grid grid-cols-3 gap-2">
          <LaneStatTile label="CS @ 10" metric={data.csAt10} />
          <LaneStatTile label="CS @ 15" metric={data.csAt15} />
          <LaneStatTile label="Gold @ 10" metric={data.goldAt10} />
        </div>
      }
    />
  );
}
