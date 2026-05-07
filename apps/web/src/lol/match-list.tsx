import { championCenteredSplashUrl } from "@/lib/champion-icon";
import { cn } from "@/lib/utils";
import { shouldFlipChampion } from "@/lol/champion-direction";
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
}: {
  matches: MatchSummary[];
  accountSlug: string;
}) {
  return (
    <m.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-3"
    >
      {matches.map((match) => (
        <m.li key={match.matchId} variants={item}>
          <Link
            to="/lol/$accountSlug/matches/$matchId"
            params={{ accountSlug, matchId: match.matchId }}
            className={cn(
              "group relative flex h-28 items-center gap-4 overflow-hidden rounded-md border pl-3 pr-4 transition-all hover:scale-[1.005]",
              match.win
                ? "border-emerald-500/30 hover:border-emerald-500/60"
                : "border-red-500/30 hover:border-red-500/60"
            )}
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 right-1/3 overflow-hidden">
              <div className="size-full transition-transform duration-700 ease-out group-hover:scale-105">
                <img
                  src={championCenteredSplashUrl(match.champion)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className={cn(
                    "size-full object-cover object-[center_30%] opacity-95 transition-opacity duration-300 group-hover:opacity-100",
                    shouldFlipChampion(match.champion) && "-scale-x-100"
                  )}
                />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent from-10% via-background/60 via-45% to-background to-[67%]" />

            <m.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "relative h-20 w-1 origin-center rounded-full",
                match.win ? "bg-emerald-500" : "bg-red-500"
              )}
            />
            <div className="relative ml-auto flex flex-col items-end gap-1">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{match.champion}</span>
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
                <span className="text-emerald-400">{match.kills}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-red-400">{match.deaths}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-amber-400">{match.assists}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {match.queueType} · {formatDuration(match.durationSec)} ·{" "}
                {formatTimeAgo(match.playedAt)}
              </div>
            </div>
          </Link>
        </m.li>
      ))}
    </m.ul>
  );
}
