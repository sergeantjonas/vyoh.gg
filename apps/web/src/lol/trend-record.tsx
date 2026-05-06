import { cn } from "@/lib/utils";
import type { MatchSummary } from "@vyoh/shared";

export function TrendRecord({ matches }: { matches: MatchSummary[] }) {
  const ordered = [...matches].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Recent record</h3>
      <div className="flex flex-wrap gap-1.5">
        {ordered.map((m) => (
          <div
            key={m.matchId}
            title={`${m.champion} — ${m.win ? "Win" : "Loss"}`}
            className={cn("size-3 rounded-full", m.win ? "bg-emerald-500" : "bg-red-500")}
          />
        ))}
      </div>
    </div>
  );
}
