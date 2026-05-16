import { CardShell } from "@/components/card-shell";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useGameAchievements } from "./use-game-achievements";

const TOOLTIP_CONTENT_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

interface CompletionVerdictCardProps {
  appid: number;
}

// Verdict copy bands. Lifted from "what would I say to myself looking at
// this game's achievement state" — terse, present-tense, no false praise
// at low percentages. 100% gets a distinct line because it's a different
// shape of accomplishment.
function verdictFor(unlocked: number, total: number, pct: number): string {
  if (total === 0) return "No achievements defined.";
  if (unlocked === 0) return "Owned but untouched on the achievement front.";
  if (pct === 100) return "100% complete — every achievement earned.";
  if (pct >= 75) return `Closing in — ${total - unlocked} to go.`;
  if (pct >= 50) return "Past the halfway mark.";
  if (pct >= 25) return "Working through it.";
  return "Just getting started.";
}

export function CompletionVerdictCard({ appid }: CompletionVerdictCardProps) {
  // Same query key as AchievementPanel — TanStack Query dedupes the fetch,
  // so this self-contained data dependency costs nothing on the wire.
  const { data, isPending } = useGameAchievements(appid);

  // Hide the card entirely when there's no achievement schema (CS2, demos),
  // when the schema is empty (first-deploy edge case), or while loading.
  // Matches the panel's null-render contract; the route renders both
  // conditionally on `game` already.
  if (isPending || !data || data.achievements === null) return null;
  const achievements = data.achievements;
  if (achievements.length === 0) return null;

  const total = achievements.length;
  const unlocked = achievements.filter((a) => a.unlockedAt !== null).length;
  const pct = total === 0 ? 0 : Math.round((unlocked / total) * 100);

  // Rare = global unlock % below 5%; very-rare below 1%. Only count rows
  // the owner has actually unlocked — the value is "look what you pulled
  // off," not "look what exists." `globalPercent` can be null when the
  // weekly rarity poller hasn't covered a row yet (newly-added game),
  // those are excluded from the count rather than treated as 0.
  const rareUnlocked = achievements.filter(
    (a) => a.unlockedAt !== null && a.globalPercent !== null && a.globalPercent < 5
  ).length;
  const veryRareUnlocked = achievements.filter(
    (a) => a.unlockedAt !== null && a.globalPercent !== null && a.globalPercent < 1
  ).length;

  const evidence = rareUnlocked > 0 && (
    <p className="text-xs text-muted-foreground">
      {veryRareUnlocked > 0 ? (
        <>
          <span className="font-medium text-amber-400">{veryRareUnlocked} very rare</span>{" "}
          (under 1% global)
          {rareUnlocked > veryRareUnlocked && (
            <> + {rareUnlocked - veryRareUnlocked} rare (under 5%)</>
          )}
        </>
      ) : (
        <>
          <span className="font-medium text-amber-400">{rareUnlocked} rare</span> unlock
          {rareUnlocked === 1 ? "" : "s"} under 5% global
        </>
      )}
    </p>
  );

  return (
    <CardShell
      title="Completion"
      indicator={
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <span className="shrink-0 cursor-help text-xs tabular-nums text-muted-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
              {unlocked}/{total} · {pct}%
            </span>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side="top"
              sideOffset={4}
              className={TOOLTIP_CONTENT_CLASS}
            >
              Your completion: {unlocked} of {total} achievements unlocked ({pct}%).
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      }
      verdict={verdictFor(unlocked, total, pct)}
      evidence={evidence || undefined}
      empty={unlocked === 0 && total > 0}
    />
  );
}
