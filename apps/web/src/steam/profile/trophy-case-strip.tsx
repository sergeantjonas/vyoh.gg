import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { steamAchievementIconUrl, steamCapsuleUrl } from "@/steam/_shared/steam-image";
import { prefetchSteamGameBackdrop } from "@/steam/profile-backdrop";
import { useCrossGameRarest } from "@/steam/use-cross-game-rarest";
import { useSteamOwnedGames } from "@/steam/use-owned-games";
import { Link } from "@tanstack/react-router";
import type { SteamOwnedGame, SteamRecentUnlock } from "@vyoh/shared";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

// Fetch a wider window than the eye can take in — the carousel rotates through
// every entry that clears the sub-10% gate, so the upper bound is "how many
// rare unlocks worth surfacing" not "how many tiles fit on screen". The gate
// itself keeps the case meaningful as the library grows.
const FETCH_LIMIT = 50;
const RARITY_GATE = 10;

interface TrophyEntry {
  unlock: SteamRecentUnlock;
  assetTimestamp: number | null;
}

function joinEntries(
  unlocks: SteamRecentUnlock[],
  owned: SteamOwnedGame[]
): TrophyEntry[] {
  const tsByAppid = new Map(owned.map((g) => [g.appid, g.assetTimestamp]));
  const entries: TrophyEntry[] = [];
  for (const u of unlocks) {
    const pct = u.globalPercent;
    if (pct == null || pct >= RARITY_GATE) continue;
    entries.push({ unlock: u, assetTimestamp: tsByAppid.get(u.appid) ?? null });
  }
  return entries;
}

export function TrophyCaseStrip() {
  const rarest = useCrossGameRarest(FETCH_LIMIT);
  const owned = useSteamOwnedGames();
  // Autoplay plugin holds its own state across renders; a ref keeps the
  // instance stable so Embla doesn't reset the timer every paint. With
  // stopOnInteraction:true the first manual click halts rotation — predictable
  // browsing wins over perpetual motion, and hover-pause still covers the
  // passive "user is reading this row" case.
  const autoplay = useRef(
    Autoplay({ delay: 6000, stopOnMouseEnter: true, stopOnInteraction: true })
  );

  // Pre-rarity-poll, mid-fetch, or owned-games not in yet — collapse silently.
  // The recent-unlocks chip below still renders; nothing about the page shifts.
  if (!rarest.data || !owned.data) return null;
  const entries = joinEntries(rarest.data.unlocks, owned.data.games);
  if (entries.length === 0) return null;

  return (
    <Carousel
      opts={{ loop: true, align: "start", slidesToScroll: 1 }}
      plugins={[autoplay.current]}
      className="flex flex-col gap-3"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Trophy case
        </h2>
        <div className="flex items-center gap-3">
          <CarouselHeaderControls />
          <Link
            to="/steam/achievements/signature"
            className="text-xs text-muted-foreground/70 underline-offset-2 hover:underline"
          >
            See full signature →
          </Link>
        </div>
      </header>
      {/* Right-edge fade lets the half-visible "next" tile read as a tease
          rather than a hard cut. The left edge stays clean — slides are
          start-aligned so the first tile sits flush. */}
      <div className="[mask-image:linear-gradient(to_right,black_0,black_calc(100%-48px),transparent)]">
        <CarouselContent className="-ml-3">
          {entries.map((entry) => (
            <CarouselItem
              key={`${entry.unlock.appid}-${entry.unlock.apiName}`}
              className="basis-auto pl-3"
            >
              <TrophyTile entry={entry} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </div>
    </Carousel>
  );
}

function CarouselHeaderControls() {
  const { scrollPrev, scrollNext } = useCarousel();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={scrollPrev}
        aria-label="Previous trophies"
        className="rounded-full text-muted-foreground/70 hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={scrollNext}
        aria-label="Next trophies"
        className="rounded-full text-muted-foreground/70 hover:text-foreground"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function TrophyTile({ entry }: { entry: TrophyEntry }) {
  const { unlock, assetTimestamp } = entry;
  const pct = unlock.globalPercent ?? 0;
  // Mirror RarestSection's threshold — sub-5% gets the amber treatment, the
  // rest read as plain trophies. The capsule is the frame either way.
  const isAmber = pct < 5;
  const prefetch = () => prefetchSteamGameBackdrop(unlock.appid, assetTimestamp);

  return (
    <div className="w-[184px] shrink-0">
      <Link
        to="/steam/game/$appid"
        params={{ appid: String(unlock.appid) }}
        search={{ ach: unlock.apiName }}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        className="group flex flex-col gap-1.5"
      >
        <div
          className={
            isAmber
              ? "relative h-[69px] w-[184px] overflow-hidden rounded-md border border-amber-400/30 ring-1 ring-amber-400/10 transition-colors group-hover:border-amber-400/50"
              : "relative h-[69px] w-[184px] overflow-hidden rounded-md border border-border/40 transition-colors group-hover:border-border"
          }
        >
          <img
            src={steamCapsuleUrl(unlock.appid, assetTimestamp)}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover opacity-50 transition-opacity group-hover:opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/40 to-transparent" />
          <img
            src={steamAchievementIconUrl(unlock.appid, unlock.apiName)}
            alt=""
            loading="lazy"
            className="absolute bottom-1.5 left-1.5 size-10 rounded shadow-lg ring-1 ring-black/40"
          />
          <span
            className={
              isAmber
                ? "absolute right-1.5 top-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-amber-300 backdrop-blur-sm"
                : "absolute right-1.5 top-1.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground/80 backdrop-blur-sm"
            }
          >
            {pct.toFixed(1)}%
          </span>
        </div>
        <div className="flex min-w-0 flex-col">
          <p
            className={
              isAmber
                ? "truncate text-xs font-medium text-amber-200/90"
                : "truncate text-xs font-medium text-foreground/85"
            }
          >
            {unlock.displayName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground/70">
            {unlock.gameName}
          </p>
        </div>
      </Link>
    </div>
  );
}
