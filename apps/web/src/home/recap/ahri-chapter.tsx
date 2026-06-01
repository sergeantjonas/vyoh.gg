import { CountUp } from "@/components/count-up";
import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { AHRI_SKIN_ROTATION } from "@/home/landing-config";
import { mainScrollRef } from "@/lib/scroll-container";
import { championBackdropSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useChampionRecap } from "@/lol/champions/use-champion-recap";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import { type LolAccount, formatKda } from "@vyoh/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChapterCloser,
  ChapterDetail,
  ChapterOpener,
  ChapterStats,
} from "./chapter-bands";
import { ChapterContainer } from "./chapter-container";
import { ChapterReveal } from "./chapter-reveal";
import { useAssetClaim } from "./use-asset-claim";
import { useSkinRotation } from "./use-skin-rotation";

const CHAMPION_ALIAS = "Ahri";

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/**
 * First end-to-end recap chapter (R-2). Renders the Ahri subject inside a
 * single sticky-pin window with four bands: opener, recent-detail strip,
 * aggregate stats, and a closer link into the deep route.
 *
 * The chapter publishes its splash via `useAssetClaim` so the shared
 * atmosphere layer paints it full-bleed with directional masking and the
 * substrate tinting follows. Skin rotation across the pin window lands in
 * R-2c; until then `AHRI_SKIN_ROTATION` stays single-entry and the chapter
 * rests on the base splash for the full window.
 */
export function AhriChapter({ account }: { account: LolAccount }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const championName = useChampionName();
  const patch = useDDragonVersion();
  // Server-derived recap over the trailing 365 days of stored Ahri matches.
  // The hook returns a small typed aggregate (totals, peaks, signature game,
  // recent strip) so the chapter no longer has to flatten + filter pages of
  // mixed-champion match summaries on every render.
  const recapQuery = useChampionRecap(account, CHAMPION_ALIAS);
  const recap = recapQuery.data;

  // Auto-cycling rotation — timer-driven, not scroll-coupled. The earlier
  // progress-driven version mapped fast scrolls to rapid skin swaps, which
  // read as chaotic instead of ambient. Auto-cycle keeps the background
  // passive while scroll position drives only the reveal animations.
  const rotation = useSkinRotation(AHRI_SKIN_ROTATION.length);
  const activeSkin = AHRI_SKIN_ROTATION[rotation.activeIndex] ??
    AHRI_SKIN_ROTATION[0] ?? { name: "Base" };
  // `imageUrl` override wins when set; falls back to the proxy-served base
  // splash. Once the image proxy gains skin-index support, this composes
  // through it instead of a free-form override URL.
  const splashUrl =
    activeSkin.imageUrl ?? championBackdropSplashUrl(CHAMPION_ALIAS, patch);

  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);

  // Splash prefetch. The base splash starts fetching on mount so it's ready
  // by the time the chapter scrolls into view (no ambient-hero pop-through).
  // Other rotation skins prefetch after a short delay so they don't compete
  // with critical-path resources during initial page load — they only need
  // to be in cache by the time the auto-cycle ticks to them (~5s in).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const baseUrl =
      AHRI_SKIN_ROTATION[0]?.imageUrl ?? championBackdropSplashUrl(CHAMPION_ALIAS, patch);
    const baseImg = new Image();
    baseImg.src = baseUrl;
    const others = AHRI_SKIN_ROTATION.slice(1)
      .map((s) => s.imageUrl)
      .filter((u): u is string => Boolean(u));
    const timer = window.setTimeout(() => {
      for (const url of others) {
        const img = new Image();
        img.src = url;
      }
    }, 800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [patch]);
  // Per-chapter `--accent` cascade: the chapter's dominant champion-asset hex
  // drives `--accent` while the chapter is in view. Layer publishes it from
  // the dominant claim — falls back to the static neutral token outside any
  // subject chapter. championTheme is the same colour pipeline /lol routes
  // already use for `--theme-color`.
  const accentHex = championTheme(CHAMPION_ALIAS).dominantHex;
  const claim = useMemo(
    () => ({
      image: splashUrl,
      palette,
      bloomBlurPx: rotation.bloomBlurPx,
      accentHex,
    }),
    [splashUrl, palette, rotation.bloomBlurPx, accentHex]
  );
  useAssetClaim(outerRef, claim);

  // Polite one-shot nudge into the chapter pin. Triggers when the chapter
  // outer is 8% visible — i.e. roughly when the opener band's top edge
  // first enters the viewport from below. Smooth-scrolls main so the
  // chapter top aligns with viewport top (pin start), then flips `nudged`
  // ~500ms later (smooth-scroll settle window) to release the gated band
  // reveals. Lands the user in a stable view first, then plays the reveal
  // cascade from there — no animation runs during the approach scroll.
  //
  // One-shot: scrolling back up doesn't re-yank. Smooth-scroll respects
  // active user input mid-nudge (their scroll wins).
  const [nudged, setNudged] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setNudged(true);
      return;
    }
    const el = outerRef.current;
    if (!el) return;
    const main = mainScrollRef.current;
    let triggered = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.08 && !triggered) {
            triggered = true;
            if (main) {
              const target =
                main.scrollTop +
                el.getBoundingClientRect().top -
                main.getBoundingClientRect().top;
              main.scrollTo({ top: target, behavior: "smooth" });
            } else {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            settleTimer = setTimeout(() => setNudged(true), 500);
            observer.disconnect();
            break;
          }
        }
      },
      {
        root: main ?? null,
        threshold: 0.08,
      }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  // Recap may be `undefined` while loading or on error. Default to the
  // zero-state shape so the chapter still renders its layout (with em-dashes
  // and the empty-recent fallback) instead of unmounting.
  const totalGames = recap?.totalGames ?? 0;
  const wins = recap?.wins ?? 0;
  const losses = recap?.losses ?? 0;
  const winRate = recap?.winRate ?? 0;
  const avgKda = recap?.avgKda ?? 0;
  const recent = recap?.recentMatches ?? [];
  const displayName = championName(CHAMPION_ALIAS);
  const eyebrow = `Your ${displayName}`;
  const skinSubtitle = activeSkin.name === "Base" ? null : activeSkin.name;

  // Band scrim — dark card with subtle local backdrop blur so copy stays
  // readable against the now-sharp splash. Each band's scrim wrapper is
  // itself a `ChapterReveal` so scrim opacity rides the same timed reveal
  // MV as the inner content — no more "empty boxes" window where the chrome
  // is faded in but the text is still gated on further scroll. `max-w-prose`
  // keeps editorial measure ~65ch; the pin's `items-center justify-center`
  // centers each band within the viewport.
  const bandScrim =
    "w-full max-w-prose rounded-xl border border-border/30 bg-background/55 px-6 backdrop-blur-sm";

  return (
    <div ref={outerRef} data-recap-chapter="ahri">
      <ChapterContainer
        pinViewports={2}
        slug="ahri"
        ariaLabel={eyebrow}
        pinClassName="items-center justify-start px-6 pt-[12dvh]"
      >
        <ChapterReveal active={nudged} className={bandScrim}>
          <ChapterOpener>
            <ChapterReveal active={nudged} delay={0.05}>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
                {eyebrow}
              </p>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.18}>
              <h2 className="text-5xl font-semibold leading-none text-foreground sm:text-6xl">
                {displayName}
              </h2>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.32}>
              <p className="text-base text-muted-foreground">
                <CountUp to={totalGames} /> {totalGames === 1 ? "game" : "games"} tracked
                {skinSubtitle ? ` · ${skinSubtitle}` : ""}
              </p>
            </ChapterReveal>
          </ChapterOpener>
        </ChapterReveal>

        <ChapterReveal active={nudged} delay={0.45} className={bandScrim}>
          <ChapterDetail>
            <ChapterReveal active={nudged} delay={0.5}>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground/70">
                Recent {displayName} games
              </h3>
            </ChapterReveal>
            {recent.length === 0 ? (
              <ChapterReveal active={nudged} delay={0.6}>
                <p className="text-sm text-muted-foreground">
                  No tracked {displayName} games yet.
                </p>
              </ChapterReveal>
            ) : (
              <ul className="flex flex-col gap-1">
                {recent.map((m, i) => {
                  // Rows cascade after the detail header at 80ms apart.
                  const delay = 0.6 + i * 0.08;
                  return (
                    <li key={m.matchId}>
                      <ChapterReveal active={nudged} delay={delay}>
                        <Link
                          to="/lol/$accountSlug/matches/$matchId"
                          params={{ accountSlug: account.slug, matchId: m.matchId }}
                          className="flex items-center gap-3 rounded-md py-1 text-sm text-foreground/90 hover:text-foreground"
                        >
                          <ChampionSquareIcon
                            championName={CHAMPION_ALIAS}
                            alt={displayName}
                            className="size-8 shrink-0 rounded ring-1 ring-border/50"
                          />
                          <span
                            className={
                              m.win
                                ? "font-semibold text-emerald-300"
                                : "font-semibold text-rose-300"
                            }
                          >
                            {m.win ? "W" : "L"}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {m.kills}/{m.deaths}/{m.assists}
                          </span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {formatRelative(m.playedAt)}
                          </span>
                        </Link>
                      </ChapterReveal>
                    </li>
                  );
                })}
              </ul>
            )}
          </ChapterDetail>
        </ChapterReveal>

        <ChapterReveal active={nudged} delay={1.1} className={bandScrim}>
          <ChapterStats>
            <ChapterReveal active={nudged} delay={1.15}>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tabular-nums text-foreground">
                  {totalGames > 0 ? `${Math.round(winRate * 100)}%` : "—"}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Win rate
                </span>
              </div>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={1.25}>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tabular-nums text-foreground">
                  {totalGames > 0 ? formatKda(avgKda) : "—"}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Avg KDA
                </span>
              </div>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={1.35}>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tabular-nums text-foreground">
                  {wins}-{losses}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Record
                </span>
              </div>
            </ChapterReveal>
          </ChapterStats>
        </ChapterReveal>

        <ChapterCloser>
          <ChapterReveal active={nudged} delay={1.55}>
            <Link
              to="/lol/$accountSlug/champions/$championKey"
              params={{
                accountSlug: account.slug,
                championKey: CHAMPION_ALIAS.toLowerCase(),
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-foreground hover:bg-card/60"
            >
              View {displayName} deep stats →
            </Link>
          </ChapterReveal>
        </ChapterCloser>
      </ChapterContainer>
    </div>
  );
}
