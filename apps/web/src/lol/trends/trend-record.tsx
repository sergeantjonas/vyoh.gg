import { cn } from "@/lib/utils";
import { useChampionName } from "@/lol/champions/use-champions";
import type { MatchSummary } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.025 } },
};

const dot: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 24 },
  },
};

export function TrendRecord({ matches }: { matches: MatchSummary[] }) {
  const ordered = [...matches].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const championName = useChampionName();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Recent record</h3>
      <m.div
        initial="hidden"
        animate="show"
        variants={container}
        className="flex flex-wrap gap-1.5"
      >
        {ordered.map((match) => (
          <m.div
            key={match.matchId}
            variants={dot}
            title={`${championName(match.champion)} — ${match.win ? "Win" : "Loss"}`}
            className={cn(
              "size-3 rounded-full",
              match.win ? "bg-emerald-500" : "bg-red-500"
            )}
          />
        ))}
      </m.div>
    </div>
  );
}
