import { cn } from "@/lib/utils";
import { Check, CircleSlash, MinusCircle } from "lucide-react";

// Visual mirror of Valve's own Deck compatibility badge taxonomy. Tier 0
// (Unknown) is omitted from the rendered set: an "unknown" chip would just
// add chrome without telling the user anything. The renderer treats null
// (no enrichment row) and 0 (upstream returned Unknown) identically and
// returns null — a missing chip is the correct "we don't know" signal.
const TIERS: Record<number, { label: string; Icon: typeof Check; className: string }> = {
  3: {
    label: "Deck Verified",
    Icon: Check,
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  },
  2: {
    label: "Deck Playable",
    Icon: MinusCircle,
    className: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  },
  1: {
    label: "Not on Deck",
    Icon: CircleSlash,
    className: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  },
};

export function DeckCompatChip({
  tier,
  size = "sm",
  className,
}: {
  tier: number | null;
  // "sm" sits inline with library-card meta. "md" pairs with the larger
  // `/steam/game/$appid` header chrome (heavier border + text).
  size?: "sm" | "md";
  className?: string;
}) {
  if (tier === null || tier === 0) return null;
  const entry = TIERS[tier];
  if (!entry) return null;
  const { Icon, label } = entry;
  const sizing =
    size === "md" ? "gap-1.5 px-2.5 py-1 text-xs" : "gap-1 px-1.5 py-0.5 text-[10px]";
  const iconSize = size === "md" ? "size-3.5" : "size-3";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        sizing,
        entry.className,
        className
      )}
    >
      <Icon className={iconSize} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
