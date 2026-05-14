import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";
import { truncatePatch } from "./patch-version";

// Returns the most recently played match's gameVersion (full 4-part string),
// or null when no match has a non-empty gameVersion. Empty-string defaults
// from un-backfilled rows are skipped.
function findLatestGameVersion(matches: readonly MatchSummary[]): string | null {
  let latest: string | null = null;
  let latestTs = Number.NEGATIVE_INFINITY;
  for (const m of matches) {
    if (!m.gameVersion) continue;
    const ts = new Date(m.playedAt).getTime();
    if (ts > latestTs) {
      latestTs = ts;
      latest = m.gameVersion;
    }
  }
  return latest;
}

export function ThisPatchBadge({
  matches,
  // Lets the caller frame the chip — Champion detail uses "Last played" so
  // it's clear the patch is the most-recent on this champion (the strip
  // below shows the rest), not a claim that all the games span one patch.
  // Profile-style usage can pass a different label if it ever lands there.
  label = "Patch",
  buildLabel = "Build",
}: {
  matches: readonly MatchSummary[];
  label?: string;
  buildLabel?: string;
}) {
  const latest = useMemo(() => findLatestGameVersion(matches), [matches]);
  if (!latest) return null;
  const short = truncatePatch(latest);
  if (!short) return null;
  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <span className="cursor-help rounded-full border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {label} {short}
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={4}
          className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md"
        >
          {buildLabel} {latest}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
