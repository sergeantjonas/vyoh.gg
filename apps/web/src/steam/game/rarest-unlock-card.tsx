import { CardShell } from "@/components/card-shell";
import { RarityPercent } from "@/steam/_shared/rarity-percent";
import { steamAchievementIconUrl } from "@/steam/_shared/steam-image";
import { useGameAchievements } from "./use-game-achievements";

interface RarestUnlockCardProps {
  appid: number;
}

function rarityQualifier(pct: number): string {
  if (pct < 1) return "Very rare";
  if (pct < 5) return "Rare";
  if (pct < 25) return "Uncommon";
  return "Common";
}

export function RarestUnlockCard({ appid }: RarestUnlockCardProps) {
  const { data, isPending } = useGameAchievements(appid);
  if (isPending || !data || data.achievements === null) return null;
  const achievements = data.achievements;
  if (achievements.length === 0) return null;

  // Lowest global percent among unlocked rows. Rows without rarity data
  // (`globalPercent === null`) are skipped — a missing rarity isn't the
  // same as 0% and shouldn't win this card.
  let rarest = null as null | (typeof achievements)[number];
  for (const a of achievements) {
    if (a.unlockedAt === null || a.globalPercent === null) continue;
    if (
      rarest === null ||
      a.globalPercent < (rarest.globalPercent ?? Number.POSITIVE_INFINITY)
    ) {
      rarest = a;
    }
  }
  if (rarest === null || rarest.globalPercent === null) return null;

  const pct = rarest.globalPercent;
  const qualifier = rarityQualifier(pct);

  return (
    <CardShell
      title="Rarest unlock"
      indicator={
        <RarityPercent
          percent={pct}
          className="shrink-0 text-xs font-medium text-amber-300 decoration-amber-300/40"
        />
      }
      verdict={rarest.displayName}
      evidence={
        <div className="flex items-center gap-2.5">
          <img
            src={steamAchievementIconUrl(appid, rarest.apiName)}
            alt=""
            loading="lazy"
            className="size-9 shrink-0 rounded"
          />
          <p className="line-clamp-2 text-xs text-muted-foreground">
            <span className="font-medium text-amber-300/90">{qualifier}</span>
            {rarest.description ? ` · ${rarest.description}` : ""}
          </p>
        </div>
      }
    />
  );
}
