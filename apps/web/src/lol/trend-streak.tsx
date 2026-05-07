import { cn } from "@/lib/utils";
import { m } from "motion/react";
import type { Streak } from "./trend-stats";

export function TrendStreak({ streak }: { streak: Streak | null }) {
  if (!streak) return null;
  const isWin = streak.type === "win";
  return (
    <m.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        isWin
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-red-500/40 bg-red-500/10 text-red-400"
      )}
    >
      <span aria-hidden="true">{isWin ? "🔥" : "❄️"}</span>
      <span>
        {streak.count}
        {isWin ? "W" : "L"} streak
      </span>
    </m.div>
  );
}
