import { CountUp } from "@/components/count-up";
import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { AHRI_SKIN_ROTATION } from "@/home/landing-config";
import { championBackdropSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useChampionName } from "@/lol/champions/use-champions";
import { useMatches } from "@/lol/matches/use-matches";
import { Link } from "@tanstack/react-router";
import {
  type LolAccount,
  type MatchSummary,
  excludeRemakes,
  formatKda,
} from "@vyoh/shared";
import { useEffect, useMemo, useRef } from "react";
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
const RECENT_MATCHES_DISPLAY = 5;

function kdaValue(m: MatchSummary): number {
  if (m.deaths === 0) return m.kills + m.assists;
  return (m.kills + m.assists) / m.deaths;
}

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

type AhriStats = { wins: number; losses: number; avgKda: number };

function computeAhriStats(matches: readonly MatchSummary[]): AhriStats {
  if (matches.length === 0) return { wins: 0, losses: 0, avgKda: 0 };
  let wins = 0;
  let totalKda = 0;
  for (const m of matches) {
    if (m.win) wins++;
    totalKda += kdaValue(m);
  }
  return { wins, losses: matches.length - wins, avgKda: totalKda / matches.length };
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
  const query = useMatches(account);

  const ahriMatches = useMemo(() => {
    if (!query.data) return [] as readonly MatchSummary[];
    const flat = query.data.pages.flat();
    return excludeRemakes(flat).filter((m) => m.champion === CHAMPION_ALIAS);
  }, [query.data]);

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

  const stats = useMemo(() => computeAhriStats(ahriMatches), [ahriMatches]);
  const winRate = ahriMatches.length > 0 ? stats.wins / ahriMatches.length : 0;
  const displayName = championName(CHAMPION_ALIAS);
  const recent = ahriMatches.slice(0, RECENT_MATCHES_DISPLAY);
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
        <ChapterReveal from={0} to={0.06} className={bandScrim}>
          <ChapterOpener>
            <ChapterReveal from={0.04} to={0.14}>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">
                {eyebrow}
              </p>
            </ChapterReveal>
            <ChapterReveal from={0.1} to={0.22}>
              <h2 className="text-5xl font-semibold leading-none text-foreground sm:text-6xl">
                {displayName}
              </h2>
            </ChapterReveal>
            <ChapterReveal from={0.18} to={0.3}>
              <p className="text-base text-muted-foreground">
                <CountUp to={ahriMatches.length} />{" "}
                {ahriMatches.length === 1 ? "game" : "games"} tracked
                {skinSubtitle ? ` · ${skinSubtitle}` : ""}
              </p>
            </ChapterReveal>
          </ChapterOpener>
        </ChapterReveal>

        <ChapterReveal from={0.25} to={0.32} className={bandScrim}>
          <ChapterDetail>
            <ChapterReveal from={0.3} to={0.38}>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground/70">
                Recent {displayName} games
              </h3>
            </ChapterReveal>
            {recent.length === 0 ? (
              <ChapterReveal from={0.36} to={0.46}>
                <p className="text-sm text-muted-foreground">
                  No tracked {displayName} games yet.
                </p>
              </ChapterReveal>
            ) : (
              <ul className="flex flex-col gap-1">
                {recent.map((m, i) => {
                  // Rows stagger across 0.36 → 0.62 with a 0.04 lead between
                  // each. Last row finishes by 0.62, before the stats band's
                  // scrim starts at 0.55.
                  const from = 0.36 + i * 0.04;
                  const to = from + 0.08;
                  return (
                    <li key={m.matchId}>
                      <ChapterReveal from={from} to={to}>
                        <Link
                          to="/lol/$accountSlug/matches/$matchId"
                          params={{ accountSlug: account.slug, matchId: m.matchId }}
                          className="flex items-center gap-3 rounded-md py-1 text-sm text-foreground/90 hover:text-foreground"
                        >
                          <ChampionSquareIcon
                            championName={m.champion}
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

        <ChapterReveal from={0.55} to={0.62} className={bandScrim}>
          <ChapterStats>
            <ChapterReveal from={0.6} to={0.7}>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tabular-nums text-foreground">
                  {ahriMatches.length > 0 ? `${Math.round(winRate * 100)}%` : "—"}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Win rate
                </span>
              </div>
            </ChapterReveal>
            <ChapterReveal from={0.64} to={0.74}>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tabular-nums text-foreground">
                  {ahriMatches.length > 0 ? formatKda(stats.avgKda) : "—"}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Avg KDA
                </span>
              </div>
            </ChapterReveal>
            <ChapterReveal from={0.68} to={0.78}>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tabular-nums text-foreground">
                  {stats.wins}-{stats.losses}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Record
                </span>
              </div>
            </ChapterReveal>
          </ChapterStats>
        </ChapterReveal>

        <ChapterCloser>
          <ChapterReveal from={0.82} to={0.95}>
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
