import { CountUp } from "@/components/count-up";
import { cn } from "@/lib/utils";
import { CardTilt } from "@/lol/card-tilt";
import {
  ChampionCardChrome,
  championCardClassName,
  championCardStyle,
} from "@/lol/champion-card";
import { useChampionName } from "@/lol/use-champions";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

export function MatchList({
  matches,
  accountSlug,
  onCardHover,
}: {
  matches: MatchSummary[];
  accountSlug: string;
  onCardHover?: (champion: string) => void;
}) {
  const championName = useChampionName();
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-3"
    >
      {matches.map((match) => (
        <m.li key={match.matchId} variants={item}>
          <CardTilt>
            <Link
              to="/lol/$accountSlug/matches/$matchId"
              params={{ accountSlug, matchId: match.matchId }}
              onMouseEnter={() => onCardHover?.(match.champion)}
              style={championCardStyle(match.champion)}
              className={championCardClassName}
            >
              <ChampionCardChrome champion={match.champion} win={match.win} />
              <div className="relative ml-auto flex flex-col items-end gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{championName(match.champion)}</span>
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      match.win ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {match.win ? "Win" : "Loss"}
                  </span>
                </div>
                <div className="font-mono text-sm tabular-nums">
                  <CountUp to={match.kills} className="text-emerald-400" />
                  <span className="text-muted-foreground"> / </span>
                  <CountUp to={match.deaths} className="text-red-400" />
                  <span className="text-muted-foreground"> / </span>
                  <CountUp to={match.assists} className="text-amber-400" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {match.queueType} · {formatDuration(match.durationSec)} ·{" "}
                  {formatTimeAgo(match.playedAt)}
                </div>
              </div>
            </Link>
          </CardTilt>
        </m.li>
      ))}
    </m.ul>
  );
}
