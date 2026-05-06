import { cn } from "@/lib/utils";
import type { MatchSummary } from "@vyoh/shared";
import { type Variants, motion } from "motion/react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function MatchList({ matches }: { matches: MatchSummary[] }) {
  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-2"
    >
      {matches.map((m) => (
        <motion.li
          key={m.matchId}
          variants={item}
          className={cn(
            "flex items-center justify-between rounded-md border p-3",
            m.win
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/30 bg-red-500/5"
          )}
        >
          <div>
            <div className="font-medium">{m.champion}</div>
            <div className="text-sm text-muted-foreground">{m.queueType}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm">
              {m.kills} / {m.deaths} / {m.assists}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDuration(m.durationSec)} · {formatTimeAgo(m.playedAt)}
            </div>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
