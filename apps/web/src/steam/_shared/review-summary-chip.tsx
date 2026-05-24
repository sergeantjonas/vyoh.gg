import { cn } from "@/lib/utils";
import type { SteamReviewSummary } from "@vyoh/shared";

// Maps Steam's editorial review labels to a colour family. Mirrors the
// storefront's own palette so visitors recognise "Very Positive" at a
// glance without needing to read the count. Unknown labels fall back to
// the neutral zinc family — safer than asserting a colour for an unseen
// future label.
const LABEL_COLOR: Record<string, string> = {
  "Overwhelmingly Positive": "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  "Very Positive": "border-green-400/40 bg-green-500/15 text-green-200",
  Positive: "border-lime-400/40 bg-lime-500/15 text-lime-200",
  "Mostly Positive": "border-lime-400/40 bg-lime-500/15 text-lime-200",
  Mixed: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  "Mostly Negative": "border-orange-400/40 bg-orange-500/15 text-orange-200",
  Negative: "border-red-400/40 bg-red-500/15 text-red-200",
  "Very Negative": "border-red-500/50 bg-red-600/15 text-red-300",
  "Overwhelmingly Negative": "border-red-600/60 bg-red-700/20 text-red-300",
};

const NEUTRAL = "border-zinc-500/40 bg-zinc-500/10 text-zinc-200";
const COUNT_FORMAT = new Intl.NumberFormat("en-US");

export function ReviewSummaryChip({
  summary,
  className,
}: {
  summary: SteamReviewSummary | null;
  className?: string;
}) {
  if (summary === null) return null;
  const colour = LABEL_COLOR[summary.reviewScoreLabel] ?? NEUTRAL;
  return (
    <span
      title={`${summary.percentPositive}% of ${COUNT_FORMAT.format(summary.reviewCount)} user reviews are positive`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        colour,
        className
      )}
    >
      <span>{summary.reviewScoreLabel}</span>
      <span aria-hidden className="opacity-60">
        ·
      </span>
      <span className="tabular-nums">{COUNT_FORMAT.format(summary.reviewCount)}</span>
    </span>
  );
}
