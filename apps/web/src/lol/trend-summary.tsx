import type { TrendSummary } from "./trend-stats";

function formatPlaytime(sec: number): string {
  const hours = sec / 3600;
  if (hours < 1) return `${Math.round(sec / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function TrendSummaryCards({ summary }: { summary: TrendSummary }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <Stat
        label="Record"
        value={`${summary.wins}W ${summary.losses}L`}
        sub={`${Math.round(summary.winRate * 100)}% win rate`}
      />
      <Stat
        label="KDA"
        value={summary.avgKda.toFixed(2)}
        sub={`${summary.totalKills} / ${summary.totalDeaths} / ${summary.totalAssists}`}
      />
      <Stat
        label="Played"
        value={formatPlaytime(summary.totalDurationSec)}
        sub={`${summary.games} ${summary.games === 1 ? "game" : "games"}`}
      />
    </div>
  );
}
