import { Link } from "@tanstack/react-router";
import type { LolAccount, LolMomentChapterDescriptor } from "@vyoh/shared";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import type { AtmosphereClaim } from "@/home/atmosphere/use-atmosphere-claim";
import { championHdSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";

import { ChapterMultiBeat } from "./chapter-multi-beat";
import { useChapterGroupNudge } from "./chapter-nudge-contexts";
import { ChapterReveal } from "./chapter-reveal";
import {
  SHADOW_ACCENT,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
} from "./chapter-shadows";
import { LolMomentBeat } from "./lol-moment-beat";
import { MultiBeat } from "./multi-beat";
import { preloadLinkAsImage } from "./preload-link";
import { useAssetPreload } from "./use-asset-preload";
import { FocalBeatAtmosphereClaim } from "./use-focal-beat-claim";

/** Anchor champion alias — the chapter's atmosphere claim uses this splash
 *  as the shared backdrop across every beat. Pairs with the editorial
 *  framing ("Beyond Ahri") in the masthead. */
const ANCHOR_CHAMPION_ALIAS = "Ahri";

/**
 * Aggregator masthead — mirrors `AhriChapterMasthead`. Lives in the
 * `ChapterMultiBeat` identity slot so the editorial framing ("vyoh's LoL
 * year" + "Moments") stays sticky across all beats.
 *
 * The masthead links to the LoL account landing route — the chapter is the
 * editorial pin into the deeper LoL surfaces, so the title-as-link
 * pattern carries the visitor through with one click.
 *
 * Same two-presence-layers pattern as the subject chapters: `nudged`
 * drives the outer opacity fade for chapter transitions, `hasEntered`
 * latches the per-element ChapterReveal cascade so the editorial blur-
 * rise plays exactly once per page session even if the user backscrolls.
 */
function LolMomentsAggregatorMasthead({
  accountGameName,
  accountSlug,
  momentCount,
}: {
  accountGameName: string;
  accountSlug: string;
  momentCount: number;
}) {
  const nudged = useChapterGroupNudge();
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => {
    if (nudged && !hasEntered) setHasEntered(true);
  }, [nudged, hasEntered]);
  return (
    <motion.div
      initial={false}
      animate={{ opacity: nudged ? 1 : 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex w-full flex-col items-start gap-3 px-6 pt-12 sm:px-10 sm:pt-16"
    >
      <ChapterReveal active={hasEntered} delay={0.05} blur={4}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium uppercase tracking-[0.18em]">
          <span
            style={{
              color: "var(--accent, currentColor)",
              paintOrder: "stroke",
              WebkitTextStroke: STROKE_ACCENT,
              textShadow: SHADOW_ACCENT,
            }}
          >
            {accountGameName}'s LoL year
          </span>
          <span
            aria-hidden="true"
            className="text-foreground/40"
            style={{ textShadow: SHADOW_LABEL }}
          >
            ·
          </span>
          <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
            {momentCount === 1 ? "1 standout" : `${momentCount} standouts`}
          </span>
        </p>
      </ChapterReveal>
      <ChapterReveal active={hasEntered} delay={0.18} duration={1.1} blur={16} rise={20}>
        <Link
          to="/lol/$accountSlug"
          params={{ accountSlug }}
          className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
        >
          <h2
            className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
            style={{ textShadow: SHADOW_MASTHEAD }}
          >
            Moments
          </h2>
          <p
            className="text-base italic text-foreground/80 sm:text-lg"
            style={{ textShadow: SHADOW_LABEL }}
          >
            where the routine cracked
          </p>
        </Link>
      </ChapterReveal>
    </motion.div>
  );
}

/**
 * LoL moments multi-beat aggregator (R-12.5). Groups every detected LoL
 * moment (RANK_UP, KDA_OUTLIER, STREAK_5W/L, RETURN_FROM_HIATUS, MARATHON,
 * OFF_META_PICK) into a single `ChapterMultiBeat` chapter — one beat per
 * moment — instead of rendering each moment as its own pinned chapter on
 * the landing stream.
 *
 * Editorial framing: the Ahri chapter is the LoL subject. This chapter is
 * "the rest of the LoL year" — the standout moments that don't fit the
 * routine. Hence the masthead "Moments / where the routine cracked"
 * paired with the anchor Ahri splash as the shared atmosphere.
 *
 * Architecture (Path A from the R-12 plan): the chapter publishes ONE
 * atmosphere claim — anchor Ahri splash + Ahri palette / accent — that
 * covers every beat. Per-moment visual differentiation comes through the
 * beat content's `accentClass` (per-momentType typographic tint), the
 * leading-visual icon (rank emblem, clock, hourglass, trophy, streak
 * pips), and the per-type receipt shape. Path B (per-beat atmosphere
 * claims) is parked until R-13.x if it proves visually necessary.
 *
 * Beats render in the order the `moments` array provides (currently
 * recency-decayed score order from `selectChapters` server-side). No
 * per-beat reordering inside the aggregator — the upstream score IS the
 * "what's most notable" framing the visitor should see first.
 *
 * The component renders `null` for an empty `moments` array; callers
 * (`routes/index.tsx`) gate on `moments.length > 0` before mounting.
 */
export function LolMomentsAggregator({
  moments,
  account,
}: {
  moments: LolMomentChapterDescriptor[];
  account: LolAccount;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const patch = useDDragonVersion();
  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  // Per-beat atmosphere claims: each beat publishes the focal moment's
  // champion HD splash + dominantHex, so as the user scrolls between
  // beats the backdrop crossfades from one champion to the next instead
  // of holding the Ahri anchor across all of them. The HD variant
  // (1920px transcoded) replaces the prior backdrop variant (600px,
  // pre-blurred) — the atmosphere layer applies its own blur on top, so
  // a sharp source still yields an ambient backdrop but one that holds
  // up at full-bleed without visible upsampling artifacts.
  //
  // The focal beat's claim is selected by `FocalBeatAtmosphereClaim`
  // (mounted as a child of `<ChapterMultiBeat>` so it can read the
  // chapter's scrollYProgress). The atmosphere layer's two-layer image
  // stack handles the smooth crossfade between consecutive focal beats —
  // same code path that handles Ahri's skin rotation.
  const beatClaims = useMemo<AtmosphereClaim[]>(
    () =>
      moments.map((m) => {
        const alias = m.championAlias ?? ANCHOR_CHAMPION_ALIAS;
        return {
          image: championHdSplashUrl(alias, patch),
          palette,
          accentHex: championTheme(alias).dominantHex,
          intensity: 0.9,
        };
      }),
    [moments, patch, palette]
  );
  // Preload the first beat's splash up front so the visitor's first
  // scroll into the chapter doesn't catch a network fetch. Subsequent
  // beat splashes are handled by `useAssetPreload` below.
  useEffect(() => {
    const firstUrl = beatClaims[0]?.image;
    if (firstUrl) preloadLinkAsImage(firstUrl);
  }, [beatClaims]);
  // Preload every beat's HD splash once the aggregator approaches the
  // viewport. By the time the user reaches the chapter all moment
  // backdrops are in cache and the focal-beat crossfade has no
  // network-fetch hitch mid-transition.
  const allUrls = useMemo(
    () => beatClaims.map((c) => c.image).filter((u): u is string => Boolean(u)),
    [beatClaims]
  );
  useAssetPreload(outerRef, allUrls);

  // Same BEAT_LAYOUT idiom as the subject chapters: max-w-4xl reading
  // column with px-6/sm:px-10 INSIDE the 4xl box so the band edges line
  // up with the chapter masthead's 4xl wrapper (R-12.1).
  const BEAT_LAYOUT =
    "flex flex-col items-center justify-start [&>[data-band]]:!max-w-4xl [&>[data-band]]:!w-full [&>[data-band]]:!px-6 sm:[&>[data-band]]:!px-10 [&>[data-band]]:!pt-8 [&>[data-band]]:!pb-6";

  if (moments.length === 0) return null;

  // Render-prop bodies so each beat's `nudged` (per-beat active state
  // from `<MultiBeat>`) is threaded into LolMomentBeat directly. The
  // beat content is the existing per-momentType opener + detail
  // rendering, just with the atmosphere claim + chapter wrapper lifted
  // out into the aggregator.
  const beatBodies: Array<(nudged: boolean) => ReactNode> = moments.map((m) => {
    return (nudged: boolean) => {
      // The descriptor union always carries `championAlias` for LoL moments
      // since `lol-moments.service.ts` populates it from the participant
      // row. The render-time narrow guards against routes that pre-filter
      // for a `championAlias`-less descriptor before mounting the
      // aggregator (`routes/index.tsx` does this already; this is belt +
      // braces against an upstream regression).
      if (!m.championAlias) return null;
      return (
        <LolMomentBeat
          account={account}
          championAlias={m.championAlias}
          matchId={m.matchId}
          daysSince={m.daysSince}
          slug={m.slug}
          momentType={m.momentType}
          matchStats={m.matchStats}
          rankUp={m.rankUp}
          kdaOutlier={m.kdaOutlier}
          hiatusReturn={m.hiatusReturn}
          streak={m.streak}
          marathon={m.marathon}
          favoriteChampion={m.favoriteChampion}
          lifetimePeak={m.lifetimePeak}
          nudged={nudged}
        />
      );
    };
  });

  const masthead = (
    <LolMomentsAggregatorMasthead
      accountGameName={account.gameName}
      accountSlug={account.slug}
      momentCount={moments.length}
    />
  );

  return (
    <div
      ref={outerRef}
      data-recap-chapter="lol-moments"
      // Editorial voice — matches the masthead's "where the routine
      // cracked" framing rather than a flat "LoL moments" descriptor.
      // The caret displays this label when it jumps the user into this
      // chapter, so it should read like a magazine spread title, not a
      // section name.
      data-chapter-label="Off the beaten path"
    >
      <ChapterMultiBeat
        slug="lol-moments"
        ariaLabel={`${account.gameName}'s LoL moments`}
        identity={masthead}
        contextEffect={
          <FocalBeatAtmosphereClaim outerRef={outerRef} claims={beatClaims} />
        }
      >
        {beatBodies.map((body, index) => (
          <MultiBeat
            // biome-ignore lint/suspicious/noArrayIndexKey: beat order is stable across renders within one chapters() snapshot
            key={index}
            index={index}
            beatCount={beatBodies.length}
            className={BEAT_LAYOUT}
          >
            {body}
          </MultiBeat>
        ))}
      </ChapterMultiBeat>
    </div>
  );
}
