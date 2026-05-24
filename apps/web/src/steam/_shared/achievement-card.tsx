import { cn } from "@/lib/utils";
import { RarityPercent } from "@/steam/_shared/rarity-percent";
import { steamAchievementIconUrl } from "@/steam/_shared/steam-image";
import type { ReactNode } from "react";

// Steam's own client highlights very-rare unlocks distinctly; on a dense list
// this is the readability difference between "row 23 of 87" and "wait, that's
// a 0.4% unlock". Only applied to *unlocked* rows — locked-rare is a goal,
// not a flex, and shouldn't compete visually.
export function rareTier(globalPercent: number | null, unlocked: boolean) {
  const isVeryRare = unlocked && globalPercent !== null && globalPercent < 1;
  const isRare = unlocked && globalPercent !== null && globalPercent < 5 && !isVeryRare;
  return { isVeryRare, isRare };
}

export interface AchievementCardInnerProps {
  appid: number;
  apiName: string;
  displayName: string;
  description: string;
  globalPercent: number | null;
  unlocked: boolean;
  // Spoiler-mask state — locked+hidden rows render "???" + a reveal hint. The
  // owning surface decides when this is true (per-game panel toggles it; the
  // cross-game feeds never set it because every row in those feeds is
  // unlocked-by-construction).
  masked?: boolean;
  // Small line below the description. Renders only when set — used for
  // gameName · date in cross-game feeds, or "Unlocked May 15" in the per-game
  // panel. ReactNode so callers can compose a separator without a string
  // template.
  metaLine?: ReactNode;
}

// Visual primitive shared across the three achievement-card surfaces:
//   - per-game `AchievementPanel` rows (locked/unlocked, masking, deep-link
//     highlight)
//   - cross-game `RecentUnlocksVirtual` rows (always unlocked, gameName +
//     date in the meta line)
//   - cross-game `RarestSection` rows (always unlocked, gameName meta line,
//     amber qualifier in the rarity prefix)
//
// Container chrome (button vs Link vs li, hover styles, left-border accent,
// the rare-tier ring on the per-game panel) stays at each call site because
// it varies meaningfully. The duplication that was real — icon, name + rare
// tier classes, rarity badge, description line-clamp, meta line — lives here.
export function AchievementCardInner({
  appid,
  apiName,
  displayName,
  description,
  globalPercent,
  unlocked,
  masked = false,
  metaLine,
}: AchievementCardInnerProps) {
  const { isVeryRare, isRare } = rareTier(globalPercent, unlocked);

  return (
    <>
      <img
        src={steamAchievementIconUrl(appid, apiName, !unlocked)}
        alt=""
        loading="lazy"
        className={cn("size-16 shrink-0 rounded-md", !unlocked && "opacity-70")}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              "truncate text-base font-medium",
              unlocked ? "text-foreground" : "text-muted-foreground",
              isVeryRare && "text-amber-300",
              isRare && "text-amber-200"
            )}
          >
            {isVeryRare && (
              <span aria-hidden className="mr-1 text-amber-300">
                ★
              </span>
            )}
            {masked ? "???" : displayName}
          </p>
          {globalPercent !== null && (
            <RarityPercent
              percent={globalPercent}
              prefix={isVeryRare ? "Very rare · " : isRare ? "Rare · " : undefined}
              className={cn(
                "shrink-0 text-xs",
                isVeryRare
                  ? "font-semibold text-amber-300 decoration-amber-300/40"
                  : isRare
                    ? "font-semibold text-amber-200 decoration-amber-200/40"
                    : "text-muted-foreground/70"
              )}
            />
          )}
        </div>
        {(masked || description !== "") && (
          <p
            className={cn(
              "line-clamp-2 text-sm leading-snug",
              unlocked ? "text-muted-foreground" : "text-muted-foreground/60"
            )}
          >
            {masked ? "Hidden — click to reveal name" : description}
          </p>
        )}
        {metaLine && (
          <p className="text-xs tabular-nums text-muted-foreground/60">{metaLine}</p>
        )}
      </div>
    </>
  );
}
