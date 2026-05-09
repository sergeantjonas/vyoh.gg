import { useHabitsStats } from "@/lol/profile/use-habits-stats";

export function ProfileGameLength() {
  const stats = useHabitsStats();
  if (!stats) return null;

  const buckets = stats.gameLength.filter((b) => b.games > 0);
  if (buckets.length < 2) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/50 px-4 py-3">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        By game length
      </h3>
      <div className="flex gap-6">
        {buckets.map((b) => {
          const wr = Math.round((b.wins / b.games) * 100);
          return (
            <div key={b.label} className="flex flex-col gap-0.5">
              <div className="text-xs text-muted-foreground">{b.label}</div>
              <div className="text-xl font-semibold tabular-nums">{wr}%</div>
              <div className="text-[10px] text-muted-foreground/60">{b.games} games</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
