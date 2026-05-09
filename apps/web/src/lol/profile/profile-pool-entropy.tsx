import { useHabitsStats } from "@/lol/profile/use-habits-stats";

function poolLabel(unique: number, games: number): string {
  if (games === 0) return "no data";
  const ratio = unique / games;
  if (unique <= 3) return "tight pool";
  if (ratio < 0.25) return "focused pool";
  if (ratio < 0.5) return "balanced pool";
  return "versatile pool";
}

export function ProfilePoolEntropy() {
  const stats = useHabitsStats();
  if (!stats || stats.pool.totalGames === 0) return null;

  const { uniqueChampions, totalGames, days } = stats.pool;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card/50 px-4 py-3">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        Champion pool · last {days} days
      </h3>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums">{uniqueChampions}</span>
        <span className="text-sm text-muted-foreground">
          champion{uniqueChampions !== 1 ? "s" : ""} across {totalGames} game
          {totalGames !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {poolLabel(uniqueChampions, totalGames)}
      </p>
    </section>
  );
}
