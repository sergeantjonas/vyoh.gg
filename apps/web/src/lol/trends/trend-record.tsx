import { MatchPips } from "@/lol/_shared/match-pips";
import { useChampionName } from "@/lol/champions/use-champions";
import type { MatchSummary } from "@vyoh/shared";

export function TrendRecord({ matches }: { matches: MatchSummary[] }) {
  const ordered = [...matches].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const championName = useChampionName();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Recent record</h3>
      <MatchPips
        matches={ordered}
        variant="dots"
        renderTooltip={(match) =>
          `${championName(match.champion)} — ${match.win ? "Win" : "Loss"}`
        }
      />
    </div>
  );
}
