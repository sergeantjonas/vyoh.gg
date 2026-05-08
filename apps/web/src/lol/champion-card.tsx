import { championCardSplashUrl, championCenteredSplashUrl } from "@/lib/champion-icon";
import { championTheme } from "@/lib/champion-theme";
import { cn } from "@/lib/utils";
import { shouldFlipChampion } from "@/lol/champion-direction";
import { m } from "motion/react";
import { type CSSProperties, useState } from "react";

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
  // Try the resized wsrv.nl URL first; if that ever fails (proxy down,
  // upstream miss, etc.) fall back to the direct CDragon centered splash so
  // the card still renders correctly. Tracking the errored champion (rather
  // than a boolean) means a champion swap automatically retries the proxy
  // — no useEffect needed to reset state.
  const [erroredChampion, setErroredChampion] = useState<string | null>(null);
  const fallback = erroredChampion === champion;
  const src = fallback
    ? championCenteredSplashUrl(champion)
    : championCardSplashUrl(champion);

  // First-paint fade-in: stays at opacity-0 until the very first image
  // resolves, then transitions to the resting opacity. The boolean is
  // intentionally not reset on src/champion changes — once a card has had
  // anything loaded, virtualizer-driven swaps reuse the previous frame
  // until the new image decodes, so there's no flicker mid-scroll.
  const [loaded, setLoaded] = useState(false);

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
        <div className="size-full transition-transform duration-700 ease-out group-hover:scale-105">
          <img
            src={src}
            onLoad={() => setLoaded(true)}
            onError={() => setErroredChampion(champion)}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className={cn(
              "size-full object-cover object-[center_30%] transition-opacity duration-300",
              loaded ? "opacity-95 group-hover:opacity-100" : "opacity-0",
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
