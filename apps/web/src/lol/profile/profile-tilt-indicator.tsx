import { useHabitsStats } from "@/lol/profile/use-habits-stats";

const MIN_SAMPLE = 5;

interface Props {
  champion?: string;
}

export function ProfileTiltIndicator({ champion }: Props) {
  const stats = useHabitsStats(champion);
  if (!stats) return null;

  const { afterWin, afterLoss } = stats.tilt;
  if (afterWin.games < MIN_SAMPLE || afterLoss.games < MIN_SAMPLE) return null;

  const wrWin = Math.round((afterWin.wins / afterWin.games) * 100);
  const wrLoss = Math.round((afterLoss.wins / afterLoss.games) * 100);
  const diff = wrWin - wrLoss;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/50 px-4 py-3">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        After last game
      </h3>
      <div className="flex gap-6">
        <div className="flex flex-col gap-0.5">
          <div className="text-xs text-muted-foreground">After a win</div>
          <div className="text-xl font-semibold tabular-nums">{wrWin}%</div>
          <div className="text-[10px] text-muted-foreground/60">
            {afterWin.games} games
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-xs text-muted-foreground">After a loss</div>
          <div className="text-xl font-semibold tabular-nums">{wrLoss}%</div>
          <div className="text-[10px] text-muted-foreground/60">
            {afterLoss.games} games
          </div>
        </div>
      </div>
      {Math.abs(diff) >= 8 && (
        <p className="text-xs text-muted-foreground">
          {diff > 0
            ? `+${diff}pp on momentum — sessions start stronger after a win.`
            : `${Math.abs(diff)}pp lower after a win — variance or fatigue, hard to say which.`}
        </p>
      )}
    </section>
  );
}
