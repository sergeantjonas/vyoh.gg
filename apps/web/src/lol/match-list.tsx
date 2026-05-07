import { championIconUrl, championSplashUrl } from "@/lib/champion-icon";
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
              "group relative flex h-20 items-center gap-4 overflow-hidden rounded-md border pl-3 pr-4 transition-all hover:scale-[1.005]",
              match.win
                ? "border-emerald-500/30 hover:border-emerald-500/60"
                : "border-red-500/30 hover:border-red-500/60"
            )}
          >
            <img
              src={championSplashUrl(match.champion)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-70"
            />
            <div className="pointer-events-none absolute inset-0 bg-card/60" />

            <div
              className={cn(
                "relative h-12 w-1 rounded-full",
                match.win ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            <img
              src={championIconUrl(match.champion)}
              alt={match.champion}
              loading="lazy"
              className="relative size-12 rounded-md ring-1 ring-border"
            />
            <div className="relative flex-1">
              <div className="font-medium">{match.champion}</div>
              <div className="text-sm text-muted-foreground">{match.queueType}</div>
            </div>
            <div className="relative text-right">
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
