import { cn } from "@/lib/utils";
import { championCardSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { shouldFlipChampion } from "@/lol/champions/champion-direction";
import { m } from "motion/react";
import { type CSSProperties, useState } from "react";

// Keyed by champion name so a remounting card (virtualizer reuse, morphEpoch
// bump) can skip the fade.
const loadedChampions = new Set<string>();

export const championCardBaseClassName =
  "themed-card relative isolate flex h-28 items-center gap-4 overflow-hidden rounded-md border pl-3 pr-4 transition-[transform,border-color,box-shadow] duration-300 ease-out";

export const championCardClassName = `${championCardBaseClassName} themed-card-interactive group hover:-translate-y-0.5`;

export function championCardStyle(champion: string): CSSProperties {
  return { "--theme-color": championTheme(champion).dominantHex } as CSSProperties;
}

export function ChampionCardChrome({
  champion,
  win,
}: {
  champion: string;
  win?: boolean;
}) {
  const patch = useDDragonVersion();
  const src = championCardSplashUrl(champion, patch);
  // First-paint fade-in keyed by champion name so virtualizer / morphEpoch
  // remounts skip the fade.
  const [loaded, setLoaded] = useState(() => loadedChampions.has(champion));

  return (
    <>
      <div
        // Tinted placeholder behind the strip so a slow-loading card hints
        // at the champion's palette instead of showing empty space.
        style={{
          backgroundColor: "color-mix(in oklab, var(--theme-color) 18%, transparent)",
        }}
        className="pointer-events-none absolute inset-y-0 left-0 right-1/3 overflow-hidden rounded-l-md"
      >
        <div className="size-full card-splash-breathe">
          <img
            src={src}
            onLoad={() => {
              loadedChampions.add(champion);
              setLoaded(true);
            }}
            alt=""
            aria-hidden="true"
            loading="lazy"
            style={{ objectPosition: "center 30%" }}
            className={cn(
              "size-full object-cover transition-opacity duration-300",
              shouldFlipChampion(champion) && "-scale-x-100",
              loaded ? "opacity-95 group-hover:opacity-100" : "opacity-0"
            )}
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent from-10% via-background/60 via-45% to-background to-[67%]" />
      {win !== undefined && (
        <m.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={cn(
            "relative h-20 w-1 origin-center rounded-full",
            win ? "bg-emerald-500" : "bg-red-500"
          )}
        />
      )}
    </>
  );
}
