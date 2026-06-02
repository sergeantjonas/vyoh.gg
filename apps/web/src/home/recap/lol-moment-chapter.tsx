import { Link } from "@tanstack/react-router";
import type { LolAccount, LolMomentMatchStats } from "@vyoh/shared";
import { useEffect, useMemo, useRef } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { championHdSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useChampionName } from "@/lol/champions/use-champions";

import { ChapterDetail, ChapterOpener } from "./chapter-bands";
import { ChapterContainer } from "./chapter-container";
import { ChapterReveal } from "./chapter-reveal";
import {
  SHADOW_ACCENT,
  SHADOW_BODY,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
} from "./chapter-shadows";
import { preloadLinkAsImage } from "./preload-link";
import { useAssetClaim } from "./use-asset-claim";
import { useChapterNudge } from "./use-chapter-nudge";

/** Champion the chapter sets as the editorial baseline ("you usually play X").
 *  Used in the prose, not the visual — the chapter opens directly on the
 *  off-meta champion's splash; the prose carries the "stepped off ANCHOR"
 *  narrative. (Earlier R-6 draft tried an Ahri→other splash dissolve as the
 *  signature beat; rejected after visual review — the chapter is about the
 *  OFF-META champion, and opening on the anchor for ~800ms read as a delay
 *  rather than a beat. The prose communicates the comparison without the
 *  visual having to re-tell it.) */
const ANCHOR_CHAMPION_ALIAS = "Ahri";

function formatDaysSince(daysSince: number): string {
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 14) return "last week";
  if (daysSince < 30) return `${Math.round(daysSince / 7)} weeks ago`;
  return `${Math.round(daysSince / 30)} months ago`;
}

function formatDuration(durationSec: number): string {
  const minutes = Math.max(1, Math.round(durationSec / 60));
  return `${minutes}m`;
}

interface Props {
  account: LolAccount;
  championAlias: string;
  matchId: string | null;
  daysSince: number;
  slug: string;
  matchStats: LolMomentMatchStats | null;
}

/**
 * First moment chapter (R-6). Renders the owner's most recent OFF_META_PICK
 * — a match where they played a champion outside their usual rotation.
 *
 * Visual: single full-bleed splash of the off-meta champion (HD via
 * `championHeroSplashUrl`, 1280px). The splash is critical-preloaded via
 * `<link rel="preload">` so the bg snap-in isn't visible when scrolled
 * into. Editorial framing comes through the prose ("Stepped off Ahri for
 * a one-off run on X") + the match-stat strip (KDA, W/L, duration, queue).
 *
 * Proof-of-pattern shape for R-7's RANK_UP / KDA_OUTLIER / STREAK /
 * RETURN_FROM_HIATUS / MARATHON detectors — each will compose its own
 * per-momentType layout, sharing this chapter's structural template.
 */
export function LolMomentChapter({
  account,
  championAlias,
  matchId,
  daysSince,
  slug,
  matchStats,
}: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const championName = useChampionName();
  const patch = useDDragonVersion();
  const nudged = useChapterNudge(outerRef);

  // HD wiki splash (1920px transcoded) via the proxy's `hd` variant. The
  // `backdrop` variant the AhriChapter falls back to is 600px + pre-blurred,
  // and the `splash` variant is 1280px in-game centered crop — both
  // upsample visibly when the atmosphere layer renders them full-bleed for
  // a single-pin chapter. The atmosphere layer applies its own per-claim
  // blur on top, so passing a sharp source still yields an ambient
  // backdrop — just one that holds up to the larger crop. Same upstream
  // family (`{Name}_OriginalSkin_HD.jpg`) the Ahri-anchor chapter pins
  // explicitly in `landing-config.ts`; this helper resolves it
  // automatically for any champion alias.
  const splashUrl = useMemo(
    () => championHdSplashUrl(championAlias, patch),
    [championAlias, patch]
  );

  // Critical-path preload: the chapter has exactly one hero asset, and it's
  // the chapter's visual centerpiece. Inject `<link rel="preload">` the
  // moment the URL is known so the asset is in cache before the user
  // scrolls in. preloadLinkAsImage is idempotent so duplicating against
  // the SteamChapter's critical preload (when the moment isn't first in
  // the stream) costs nothing.
  useEffect(() => preloadLinkAsImage(splashUrl), [splashUrl]);

  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  const accentHex = championTheme(championAlias).dominantHex;
  const claim = useMemo(
    () => ({ image: splashUrl, palette, accentHex }),
    [splashUrl, palette, accentHex]
  );
  useAssetClaim(outerRef, claim);

  const displayName = championName(championAlias);
  const anchorDisplayName = championName(ANCHOR_CHAMPION_ALIAS);
  const eyebrow = "Off-meta pick";
  const whenLine = formatDaysSince(daysSince);

  return (
    <div
      ref={outerRef}
      data-recap-chapter={slug}
      data-chapter-label={`Off-meta · ${displayName}`}
      className="[scroll-snap-align:start] [scroll-snap-stop:always]"
    >
      <ChapterContainer
        pinViewports={1}
        slug={slug}
        ariaLabel={`${eyebrow}: ${displayName}`}
        pinClassName="items-start justify-start px-6 pt-[6dvh] sm:px-10"
      >
        <div className="flex w-full flex-col">
          <ChapterOpener>
            <ChapterReveal active={nudged} delay={0.05} blur={4}>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium uppercase tracking-[0.18em]">
                <span
                  style={{
                    color: "var(--accent, currentColor)",
                    paintOrder: "stroke",
                    WebkitTextStroke: STROKE_ACCENT,
                    textShadow: SHADOW_ACCENT,
                  }}
                >
                  {eyebrow}
                </span>
                {matchStats?.queueType ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="text-foreground/40"
                      style={{ textShadow: SHADOW_LABEL }}
                    >
                      ·
                    </span>
                    <span
                      className="text-foreground/75"
                      style={{ textShadow: SHADOW_LABEL }}
                    >
                      {matchStats.queueType}
                    </span>
                  </>
                ) : null}
                <span
                  aria-hidden="true"
                  className="text-foreground/40"
                  style={{ textShadow: SHADOW_LABEL }}
                >
                  ·
                </span>
                <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
                  {whenLine}
                </span>
              </p>
            </ChapterReveal>
            <ChapterReveal
              active={nudged}
              delay={0.18}
              duration={1.1}
              blur={16}
              rise={20}
            >
              {matchId ? (
                <Link
                  to="/lol/$accountSlug/matches/$matchId"
                  params={{ accountSlug: account.slug, matchId }}
                  className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
                >
                  <h2
                    className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                    style={{ textShadow: SHADOW_MASTHEAD }}
                  >
                    {displayName}
                  </h2>
                  <span className="text-sm italic text-foreground/70 opacity-0 transition-opacity group-hover/masthead:opacity-100">
                    open →
                  </span>
                </Link>
              ) : (
                <h2
                  className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                  style={{ textShadow: SHADOW_MASTHEAD }}
                >
                  {displayName}
                </h2>
              )}
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.55} blur={6}>
              <p
                className="max-w-prose text-base text-foreground/85 sm:text-lg"
                style={{ textShadow: SHADOW_BODY }}
              >
                Stepped off{" "}
                <span
                  className="font-medium italic text-foreground/95"
                  style={{
                    paintOrder: "stroke",
                    WebkitTextStroke: STROKE_ACCENT,
                    textShadow: SHADOW_ACCENT,
                  }}
                >
                  {anchorDisplayName}
                </span>{" "}
                for a one-off run on{" "}
                <span
                  className="font-medium italic text-foreground/95"
                  style={{
                    paintOrder: "stroke",
                    WebkitTextStroke: STROKE_ACCENT,
                    textShadow: SHADOW_ACCENT,
                  }}
                >
                  {displayName}
                </span>
                .
              </p>
            </ChapterReveal>
          </ChapterOpener>
          {matchStats ? (
            <ChapterDetail>
              <ChapterReveal active={nudged} delay={0.7}>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  {/* Result pill — W/L stays the loudest beat in the strip
                      because it's the lede answer to "how did the off-meta
                      run go?". `tabular-nums` shared with KDA so the row
                      reads as a single tabular receipt. */}
                  <span
                    className={[
                      "text-sm font-semibold uppercase tracking-[0.18em]",
                      matchStats.win ? "text-emerald-300" : "text-rose-300",
                    ].join(" ")}
                    style={{ textShadow: SHADOW_ACCENT }}
                  >
                    {matchStats.win ? "Win" : "Loss"}
                  </span>
                  <span
                    className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
                    style={{ textShadow: SHADOW_MASTHEAD }}
                  >
                    {matchStats.kills} / {matchStats.deaths} / {matchStats.assists}
                  </span>
                  <span
                    className="text-sm text-foreground/80 tabular-nums"
                    style={{ textShadow: SHADOW_BODY }}
                  >
                    {formatDuration(matchStats.durationSec)}
                  </span>
                </div>
              </ChapterReveal>
              {/* No `ChapterStats` band on OFF_META_PICK — R-7 moment types
                  (KDA_OUTLIER, STREAK) will populate one with comparative
                  chips (vs. average, lifetime peak). Off-meta itself doesn't
                  have comparison data the chapter can stand on. */}
            </ChapterDetail>
          ) : null}
        </div>
      </ChapterContainer>
    </div>
  );
}
