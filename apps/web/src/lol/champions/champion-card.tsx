import { cn } from "@/lib/utils";
import {
  championCardSplashUrl,
  championCenteredSplashUrl,
  championSplashUrl,
} from "@/lol/_shared/champion-icon";
import { championTheme } from "@/lol/_shared/champion-theme";
import { getResolvedSplash, resolveSplash } from "@/lol/_shared/splash-resolver";
import { shouldFlipChampion } from "@/lol/champions/champion-direction";
import { m } from "motion/react";
import { type CSSProperties, useEffect, useState } from "react";

// Keyed by champion name so a remounting card (virtualizer reuse, morphEpoch
// bump) can skip the fade regardless of which fallback URL actually loaded.
const loadedChampions = new Set<string>();

// CDragon centered splash (wsrv.nl or direct) frames the champion at ~30%
// from top. DDragon's landscape splash has the champion in the upper half
// but less precisely framed, so shift slightly higher to keep the face visible.
function splashObjectPosition(src: string): string {
  return src.includes("ddragon") ? "center 20%" : "center 30%";
}

function cardCandidates(champion: string): string[] {
  return [
    championCardSplashUrl(champion),
    championCenteredSplashUrl(champion),
    // DDragon landscape splash as last resort — 1215×717, same resolution
    // class as CDragon. Composition varies per champion but much better
    // quality than the 308×560 portrait loading art.
    championSplashUrl(champion),
  ];
}

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
  // Single-shot URL resolution per champion (see splash-resolver). Once any
  // card resolves Elise's working URL, every other card on the page picks
  // it up directly — no per-card fallback chain rolling the dice on flaky
  // wsrv.nl responses.
  const cacheKey = `card:${champion}`;
  const [src, setSrc] = useState<string | undefined>(() => getResolvedSplash(cacheKey));
  // First-paint fade-in keyed by champion name so virtualizer / morphEpoch
  // remounts skip the fade regardless of which fallback URL actually loaded.
  const [loaded, setLoaded] = useState(() => loadedChampions.has(champion));

  useEffect(() => {
    const cached = getResolvedSplash(cacheKey);
    if (cached) {
      setSrc(cached);
      return;
    }
    setSrc(undefined);
    let cancelled = false;
    resolveSplash(cacheKey, cardCandidates(champion)).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [champion, cacheKey]);

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
          {src && (
            <img
              src={src}
              onLoad={() => {
                loadedChampions.add(champion);
                setLoaded(true);
              }}
              alt=""
              aria-hidden="true"
              loading="lazy"
              style={{ objectPosition: splashObjectPosition(src) }}
              className={cn(
                "size-full object-cover transition-opacity duration-300",
                shouldFlipChampion(champion) && "-scale-x-100",
                loaded ? "opacity-95 group-hover:opacity-100" : "opacity-0"
              )}
            />
          )}
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
