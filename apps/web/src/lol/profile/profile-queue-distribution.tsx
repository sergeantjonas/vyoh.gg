import { queueColor } from "@/lol/_shared/queue-color";
import { useMatchWindow } from "@/lol/matches/match-window-context";
import { computeQueueCounts } from "@/lol/trends/trend-stats";

export function ProfileQueueDistribution() {
  const { matches } = useMatchWindow();
  if (!matches || matches.length === 0) return null;

  const counts = computeQueueCounts(matches);
  if (counts.length === 0) return null;

  const total = counts.reduce((s, c) => s + c.count, 0);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Queue distribution</h3>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {counts.map((entry) => (
          <div
            key={entry.queueType}
            style={{
              width: `${(entry.count / total) * 100}%`,
              background: queueColor(entry.queueType),
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {counts.map((entry) => (
          <li key={entry.queueType} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-sm"
              style={{ background: queueColor(entry.queueType) }}
            />
            <span>{entry.queueType}</span>
            <span className="tabular-nums text-foreground/70">{entry.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
