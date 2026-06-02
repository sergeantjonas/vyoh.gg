import { Link } from "@tanstack/react-router";
import {
  type LolAccount,
  type LolHiatusReturnStats,
  type LolKdaOutlierStats,
  type LolMomentChapterDescriptor,
  type LolMomentMatchStats,
  type LolRankUpDelta,
  type LolStreakStats,
  formatRankTitle,
} from "@vyoh/shared";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { championHdSplashUrl, rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
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
 *  Used in the OFF_META_PICK prose only — the chapter opens directly on the
 *  off-meta champion's splash; the prose carries the "stepped off ANCHOR"
 *  narrative. (Earlier R-6 draft tried an Ahri→other splash dissolve as the
 *  signature beat; rejected after visual review — the chapter is about the
 *  OFF-META champion, and opening on the anchor for ~800ms read as a delay
 *  rather than a beat. The prose communicates the comparison without the
 *  visual having to re-tell it.) */
const ANCHOR_CHAMPION_ALIAS = "Ahri";

type MomentType = LolMomentChapterDescriptor["momentType"];

/** Accent span shared between every momentType's prose — uppercase-italic,
 *  paint-order outline against the splash backdrop. Extracted so each
 *  momentType's editorial block can stay declarative. */
function Accent({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-medium italic text-foreground/95"
      style={{
        paintOrder: "stroke",
        WebkitTextStroke: STROKE_ACCENT,
        textShadow: SHADOW_ACCENT,
      }}
    >
      {children}
    </span>
  );
}

interface MomentCopy {
  eyebrow: string;
  mastheadText: string;
  /** Visual element rendered inline before the masthead text — RANK_UP uses
   *  it to carry the destination tier emblem. Null when the momentType is
   *  text-only (OFF_META_PICK, future text-heavy moment shapes). */
  leadingVisual: ReactNode | null;
  chapterLabel: string;
  ariaLabel: string;
  body: ReactNode;
}

/**
 * Per-momentType editorial copy + masthead text. RANK_UP and OFF_META_PICK
 * are the two implemented types; the remaining momentTypes fall through to
 * the off-meta framing until their R-7 chunks land — keeps the chapter
 * renderable while the detectors are added incrementally.
 */
function momentCopy(args: {
  momentType: MomentType;
  displayName: string;
  anchorDisplayName: string;
  rankUp: LolRankUpDelta | null;
  kdaOutlier: LolKdaOutlierStats | null;
  hiatusReturn: LolHiatusReturnStats | null;
  streak: LolStreakStats | null;
  emblemYear: number;
}): MomentCopy {
  const {
    momentType,
    displayName,
    anchorDisplayName,
    rankUp,
    kdaOutlier,
    hiatusReturn,
    streak,
    emblemYear,
  } = args;

  if (momentType === "RANK_UP" && rankUp) {
    const fromTitle = formatRankTitle(rankUp.fromTier, rankUp.fromRank);
    const toTitle = formatRankTitle(rankUp.toTier, rankUp.toRank);
    return {
      eyebrow: "Rank up",
      mastheadText: toTitle,
      // Destination-tier emblem sits inline before the masthead text. The
      // emblem is decorative — the tier name is already in the masthead, so
      // alt="" keeps SR users from hearing "Gold IV image, Gold IV". Sized
      // proportional to the masthead (size-20 = 80px against text-6xl) so
      // the icon reads as a peer to the headline, not as an inline glyph.
      leadingVisual: (
        <img
          src={rankEmblemUrl(rankUp.toTier, emblemYear)}
          alt=""
          loading="eager"
          className="size-20 shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-24"
        />
      ),
      chapterLabel: `Rank up · ${toTitle}`,
      ariaLabel: `Rank up: ${toTitle}`,
      body: (
        <>
          Climbed from <Accent>{fromTitle}</Accent> to <Accent>{toTitle}</Accent>,
          championed by <Accent>{displayName}</Accent>.
        </>
      ),
    };
  }

  if ((momentType === "STREAK_5W" || momentType === "STREAK_5L") && streak) {
    const isHot = streak.result === "W";
    return {
      eyebrow: isHot ? "Hot streak" : "Cold streak",
      mastheadText: displayName,
      leadingVisual: null,
      chapterLabel: `${isHot ? "Hot streak" : "Cold streak"} · ${displayName}`,
      ariaLabel: `${isHot ? "Hot streak" : "Cold streak"} on ${displayName}`,
      body: isHot ? (
        <>
          <Accent>{streak.length}</Accent> ranked wins in a row, last on{" "}
          <Accent>{displayName}</Accent>.
        </>
      ) : (
        <>
          <Accent>{streak.length}</Accent> ranked losses straight, last on{" "}
          <Accent>{displayName}</Accent>.
        </>
      ),
    };
  }

  if (momentType === "RETURN_FROM_HIATUS" && hiatusReturn) {
    // Editorial gap formatting: short hiatuses read as days, long ones as
    // weeks/months. Keeps the prose tight — "ninety days away" reads better
    // than "90 days away" on the page.
    const gapLabel = formatHiatusGap(hiatusReturn.gapDays);
    return {
      eyebrow: "Return",
      mastheadText: displayName,
      leadingVisual: null,
      chapterLabel: `Return · ${displayName}`,
      ariaLabel: `Return from hiatus on ${displayName}`,
      body: (
        <>
          <Accent>{gapLabel}</Accent> away from ranked, then back on{" "}
          <Accent>{displayName}</Accent>.
        </>
      ),
    };
  }

  if (momentType === "KDA_OUTLIER" && kdaOutlier) {
    // matchKda / baselineKda is the editorial multiplier. Guard against
    // baseline=0 (shouldn't happen — detector requires 8+ baseline games —
    // but the chapter shouldn't show "Infinity×" if the contract is ever
    // violated).
    const factor =
      kdaOutlier.baselineKda > 0 ? kdaOutlier.matchKda / kdaOutlier.baselineKda : null;
    const matchKdaLabel = kdaOutlier.matchKda.toFixed(1);
    const factorLabel = factor ? `${factor.toFixed(1)}×` : null;
    return {
      eyebrow: "Standout game",
      mastheadText: displayName,
      leadingVisual: null,
      chapterLabel: `Standout · ${displayName}`,
      ariaLabel: `Standout game on ${displayName}`,
      body: (
        <>
          Posted a <Accent>{matchKdaLabel}</Accent> KDA on <Accent>{displayName}</Accent>
          {factorLabel ? (
            <>
              {" "}
              — <Accent>{factorLabel}</Accent> the 30-day baseline
            </>
          ) : null}
          .
        </>
      ),
    };
  }

  return {
    eyebrow: "Off-meta pick",
    mastheadText: displayName,
    leadingVisual: null,
    chapterLabel: `Off-meta · ${displayName}`,
    ariaLabel: `Off-meta pick: ${displayName}`,
    body: (
      <>
        Stepped off <Accent>{anchorDisplayName}</Accent> for a one-off run on{" "}
        <Accent>{displayName}</Accent>.
      </>
    ),
  };
}

/** Editorial gap formatter for RETURN_FROM_HIATUS prose. Maps integer days
 *  to a human-readable phrase: weeks for short hiatuses, months for long
 *  ones. Threshold is HIATUS_THRESHOLD_DAYS (14d) on the detector side, so
 *  this never receives < 14. */
function formatHiatusGap(gapDays: number): string {
  if (gapDays < 30) {
    const weeks = Math.round(gapDays / 7);
    return weeks === 1 ? "A week" : `${weeks} weeks`;
  }
  if (gapDays < 60) return "A month";
  const months = Math.round(gapDays / 30);
  return `${months} months`;
}

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
  momentType: MomentType;
  matchStats: LolMomentMatchStats | null;
  rankUp: LolRankUpDelta | null;
  kdaOutlier: LolKdaOutlierStats | null;
  hiatusReturn: LolHiatusReturnStats | null;
  streak: LolStreakStats | null;
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
  momentType,
  matchStats,
  rankUp,
  kdaOutlier,
  hiatusReturn,
  streak,
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
  const emblemYear = useRankedEmblemYear();
  const copy = momentCopy({
    momentType,
    displayName,
    anchorDisplayName,
    rankUp,
    kdaOutlier,
    hiatusReturn,
    streak,
    emblemYear,
  });
  const whenLine = formatDaysSince(daysSince);

  return (
    <div
      ref={outerRef}
      data-recap-chapter={slug}
      data-chapter-label={copy.chapterLabel}
      className="[scroll-snap-align:start] [scroll-snap-stop:always]"
    >
      <ChapterContainer
        pinViewports={1}
        slug={slug}
        ariaLabel={copy.ariaLabel}
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
                  {copy.eyebrow}
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
                  {/* Inner row pairs the optional leading visual with the
                      H2 along the visual center; the outer Link stays
                      items-baseline so the trailing "open →" chip aligns
                      to the H2's text baseline (correct for OFF_META_PICK
                      where there's no leadingVisual). */}
                  <span className="inline-flex items-center gap-x-4">
                    {copy.leadingVisual}
                    <h2
                      className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                      style={{ textShadow: SHADOW_MASTHEAD }}
                    >
                      {copy.mastheadText}
                    </h2>
                  </span>
                  <span className="text-sm italic text-foreground/70 opacity-0 transition-opacity group-hover/masthead:opacity-100">
                    open →
                  </span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-x-4">
                  {copy.leadingVisual}
                  <h2
                    className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                    style={{ textShadow: SHADOW_MASTHEAD }}
                  >
                    {copy.mastheadText}
                  </h2>
                </span>
              )}
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.55} blur={6}>
              <p
                className="max-w-prose text-base text-foreground/85 sm:text-lg"
                style={{ textShadow: SHADOW_BODY }}
              >
                {copy.body}
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
