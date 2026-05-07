import { championIconUrl } from "@/lib/champion-icon";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import type { MatchSummary } from "@vyoh/shared";
import { type Variants, m } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
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
}: {
  matches: MatchSummary[];
  accountSlug: string;
}) {
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-2"
    >
      {matches.map((match) => (
        <m.li key={match.matchId} variants={item}>
          <Link
            to="/lol/$accountSlug/matches/$matchId"
            params={{ accountSlug, matchId: match.matchId }}
            className={cn(
              "flex items-center gap-4 rounded-md border p-3 transition-colors hover:bg-muted/40",
              match.win ? "border-emerald-500/30" : "border-red-500/30"
            )}
          >
            <div
              className={cn(
                "h-12 w-1 rounded-full",
                match.win ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            <img
              src={championIconUrl(match.champion)}
              alt={match.champion}
              loading="lazy"
              className="size-12 rounded-md"
            />
            <div className="flex-1">
              <div className="font-medium">{match.champion}</div>
              <div className="text-sm text-muted-foreground">{match.queueType}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-sm">
                {match.kills} / {match.deaths} / {match.assists}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDuration(match.durationSec)} · {formatTimeAgo(match.playedAt)}
              </div>
            </div>
          </Link>
        </m.li>
      ))}
    </m.ul>
  );
}
