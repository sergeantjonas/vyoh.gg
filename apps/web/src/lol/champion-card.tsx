import { championCenteredSplashUrl } from "@/lib/champion-icon";
import { championTheme } from "@/lib/champion-theme";
import { cn } from "@/lib/utils";
import { shouldFlipChampion } from "@/lol/champion-direction";
import { m } from "motion/react";
import type { CSSProperties } from "react";

export const championCardClassName =
  "themed-card group relative isolate flex h-28 items-center gap-4 overflow-hidden rounded-md border pl-3 pr-4 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5";

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
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0 right-1/3 overflow-hidden rounded-l-md">
        <div className="size-full transition-transform duration-700 ease-out group-hover:scale-105">
          <img
            src={championCenteredSplashUrl(champion)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className={cn(
              "size-full object-cover object-[center_30%] opacity-95 transition-opacity duration-300 group-hover:opacity-100",
              shouldFlipChampion(champion) && "-scale-x-100"
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
