import { Link } from "@tanstack/react-router";
import type { LolAccount, LolMomentChapterDescriptor } from "@vyoh/shared";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { championBackdropSplashUrl } from "@/lol/_shared/assets/champion-icon";
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
import { useAssetClaim } from "./use-asset-claim";
import { useAssetPreload } from "./use-asset-preload";

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
  // Shared atmosphere claim: anchor Ahri splash, time-of-day palette,
  // Ahri's dominant hex as the `--accent` cascade. The aggregator is
  // editorially adjacent to the Ahri chapter (sits immediately after),
  // and the splash continuity lets the two chapters read as one
  // extended LoL block instead of distinct surfaces.
  const splashUrl = useMemo(
    () => championBackdropSplashUrl(ANCHOR_CHAMPION_ALIAS, patch),
    [patch]
  );
  useEffect(() => preloadLinkAsImage(splashUrl), [splashUrl]);
  // Rotation skins from the Ahri chapter cover the bulk of LoL traffic on
  // `/`. The aggregator doesn't ALSO preload them — `useAssetPreload`
  // handles them when the AhriChapter approaches viewport; that
  // proximity also covers the aggregator's atmosphere swap window. The
  // aggregator only nudges its own splash through the asset-preload
  // hook to confirm cache residence as the visitor scrolls past Ahri.
  useAssetPreload(outerRef, [splashUrl]);
  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  const accentHex = championTheme(ANCHOR_CHAMPION_ALIAS).dominantHex;
  const claim = useMemo(
    () => ({ image: splashUrl, palette, accentHex }),
    [splashUrl, palette, accentHex]
  );
  useAssetClaim(outerRef, claim);

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
    <div ref={outerRef} data-recap-chapter="lol-moments" data-chapter-label="LoL moments">
      <ChapterMultiBeat
        slug="lol-moments"
        ariaLabel={`${account.gameName}'s LoL moments`}
        identity={masthead}
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
