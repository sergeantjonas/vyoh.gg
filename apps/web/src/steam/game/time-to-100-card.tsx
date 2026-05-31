import { CardShell } from "@/components/card-shell";
import type { SteamAchievement } from "@vyoh/shared";
import { relativeTimeAgo } from "@vyoh/shared";
import { useGameAchievements } from "./use-game-achievements";

interface TimeTo100CardProps {
  appid: number;
}

const DAY_MS = 86_400_000;

// Format a span of days into the densest unit that still reads honestly —
// "47 days" is more readable than "1.5 months" at the short end, and
// "4.2 years" beats "1,540 days" at the long end. Crossover points chosen
// to match how a person would describe the duration aloud.
function formatSpan(days: number): string {
  if (days <= 1) return "a single session";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 730) return `${Math.round(days / 30)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

function computeVerdict(
  unlockedRows: SteamAchievement[],
  total: number
): {
  verdict: string;
  indicator: string;
} | null {
  if (unlockedRows.length === 0) return null;
  const times = unlockedRows
    .map((a) => (a.unlockedAt ? new Date(a.unlockedAt).getTime() : null))
    .filter((t): t is number => t !== null);
  if (times.length === 0) return null;
  const first = Math.min(...times);
  const last = Math.max(...times);
  const days = Math.max(0, Math.round((last - first) / DAY_MS));

  if (unlockedRows.length === total) {
    return {
      verdict: `100%'d over ${formatSpan(days)}.`,
      indicator: `${days}d`,
    };
  }

  const firstIso = new Date(first).toISOString();
  return {
    verdict: `First unlock ${relativeTimeAgo(firstIso)} — still pecking away.`,
    indicator: `${days}d in`,
  };
}

export function TimeTo100Card({ appid }: TimeTo100CardProps) {
  const { data, isPending } = useGameAchievements(appid);
  if (isPending || !data || data.achievements === null) return null;
  const achievements = data.achievements;
  if (achievements.length === 0) return null;

  const unlockedRows = achievements.filter((a) => a.unlockedAt !== null);
  const computed = computeVerdict(unlockedRows, achievements.length);
  if (!computed) return null;

  return (
    <CardShell
      title="Timeline"
      indicator={
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {computed.indicator}
        </span>
      }
      verdict={computed.verdict}
    />
  );
}
