import { CardShell } from "@/components/card-shell";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useGameAchievements } from "./use-game-achievements";

interface RaritySignatureCardProps {
  appid: number;
  // Forwarded to CardShell — true when rendered in-panel so the tile picks
  // up the frosted recipe over the panel chrome's baked backdrop.
  frosted?: boolean;
}

// Verdict bands by mean global-unlock percentage across the owner's unlocks.
// Lower mean = the owner is hunting harder achievements than the average
// player; higher mean = mostly story-default unlocks. Cutoffs picked to
// match how Steam's own community talks about it (≤5% rare, ≤1% very rare).
function verdictFor(mean: number, sampleSize: number): string {
  if (sampleSize < 3) return "Too few unlocks to read a signature yet.";
  if (mean < 10) return "Hunter signature — sub-10% average rarity.";
  if (mean < 25) return "Goes for the rare ones.";
  if (mean < 50) return "Mix of standards and rarities.";
  if (mean < 75) return "Mostly the standard track.";
  return "Surface-level unlocks so far.";
}

export function RaritySignatureCard({ appid, frosted = true }: RaritySignatureCardProps) {
  const { data, isPending } = useGameAchievements(appid);
  if (isPending || !data || data.achievements === null) return null;
  const achievements = data.achievements;
  if (achievements.length === 0) return null;

  // Only rows the owner has unlocked, that the weekly rarity poller has
  // covered. `globalPercent === null` rows skip rather than count as 0 —
  // missing data shouldn't bias the signature toward "hunter".
  const sample = achievements
    .filter((a) => a.unlockedAt !== null && a.globalPercent !== null)
    .map((a) => a.globalPercent as number);
  if (sample.length === 0) return null;

  const mean = sample.reduce((s, p) => s + p, 0) / sample.length;
  const empty = sample.length < 3;

  return (
    <CardShell
      title="Signature"
      indicator={
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <span className="shrink-0 cursor-help text-xs tabular-nums text-muted-foreground underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
              {mean.toFixed(1)}% avg · n={sample.length}
            </span>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side="top"
              sideOffset={4}
              className={cn(TOOLTIP_CONTENT_COMPACT, "max-w-xs")}
            >
              Mean global unlock rarity across your {sample.length} unlocked achievement
              {sample.length === 1 ? "" : "s"} — lower means you're hunting the
              less-common ones.
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      }
      verdict={verdictFor(mean, sample.length)}
      empty={empty}
      frosted={frosted}
    />
  );
}
