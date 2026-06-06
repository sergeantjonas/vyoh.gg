import { Link } from "@tanstack/react-router";
import type { SteamMomentChapterDescriptor } from "@vyoh/shared";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import type { AtmosphereClaim } from "@/home/atmosphere/use-atmosphere-claim";
import { steamLibraryHeroLargeUrl } from "@/steam/_shared/steam-image";

import { ChapterMultiBeat } from "./chapter-multi-beat";
import { useChapterGroupNudge } from "./chapter-nudge-contexts";
import { ChapterReveal } from "./chapter-reveal";
import {
  SHADOW_ACCENT,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
} from "./chapter-shadows";
import { MultiBeat } from "./multi-beat";
import { preloadLinkAsImage } from "./preload-link";
import { SteamMomentBeat } from "./steam-moment-beat";
import { useAssetPreload } from "./use-asset-preload";
import { FocalBeatAtmosphereClaim } from "./use-focal-beat-claim";

/**
 * Aggregator masthead — same shape as `LolMomentsAggregatorMasthead` but
 * without the per-account voice (Steam is a stream, not an "owner of an
 * account"). The eyebrow stays subject-led at the page level ("Vyoh's
 * Steam year" if a single owner is implied) but the masthead itself is
 * the editorial frame "Highlights / what stuck this season".
 *
 * Same two-presence-layers pattern as every other subject masthead:
 * `nudged` drives outer opacity for chapter transitions, `hasEntered`
 * latches the inner blur-rise cascade so it plays once per page session.
 */
function SteamMomentsAggregatorMasthead({
  momentCount,
}: {
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
            Steam · this season
          </span>
          <span
            aria-hidden="true"
            className="text-foreground/40"
            style={{ textShadow: SHADOW_LABEL }}
          >
            ·
          </span>
          <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
            {momentCount === 1 ? "1 highlight" : `${momentCount} highlights`}
          </span>
        </p>
      </ChapterReveal>
      <ChapterReveal active={hasEntered} delay={0.18} duration={1.1} blur={16} rise={20}>
        <Link
          to="/steam"
          className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
        >
          <h2
            className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
            style={{ textShadow: SHADOW_MASTHEAD }}
          >
            Highlights
          </h2>
          <p
            className="text-base italic text-foreground/80 sm:text-lg"
            style={{ textShadow: SHADOW_LABEL }}
          >
            what stuck this season
          </p>
        </Link>
      </ChapterReveal>
    </motion.div>
  );
}

/**
 * Steam moments multi-beat aggregator (R-12.6). Groups every detected
 * Steam moment (FIRST_TIME_GAME, ACHIEVEMENT_CLUSTER) into a single
 * `ChapterMultiBeat` chapter — one beat per moment — instead of
 * rendering each moment as its own pinned chapter on the landing stream.
 *
 * Editorial framing: the Steam subjects chapters (each `<SteamChapter>`)
 * are "this is what you played a lot". The moments aggregator is "these
 * are the standout one-time events" — first time loading X, cluster of
 * achievements falling in one run. Together they cover the Steam half of
 * the self-portrait.
 *
 * Architecture (Path A from the R-12 plan): the chapter publishes ONE
 * atmosphere claim — palette-only, NO image — that covers every beat.
 * Unlike the LoL moments aggregator (anchored to Ahri's splash), Steam
 * doesn't have a per-account anchor game, so painting one game's hero as
 * the chapter background would make the aggregator read as "about that
 * game" rather than "highlights across your library". Palette-only lets
 * the time-of-day backdrop carry the visual register; per-game identity
 * lives in each beat's masthead, leading visual, and tagline.
 *
 * The component renders `null` for an empty `moments` array; callers
 * (`routes/index.tsx`) gate on `moments.length > 0` before mounting.
 */
export function SteamMomentsAggregator({
  moments,
}: {
  moments: SteamMomentChapterDescriptor[];
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  // Per-beat atmosphere: each beat publishes the focal game's library
  // hero as the backdrop instead of holding palette-only across the
  // whole chapter. Path A's palette-only framing was editorially correct
  // ("the aggregator isn't about any one game") but visually the page
  // dropped into a flat blank between subject chapters; per-beat hero
  // crossfades anchor each beat in its game without the chapter
  // claiming any single one as the headline. accentHex stays unset for
  // now (would need per-game `useSteamGameRecap`'s `dominantHex`, which
  // lives per-beat); the time-of-day palette still publishes via the
  // claim's `palette` field so the tint stays painterly.
  const beatClaims = useMemo<AtmosphereClaim[]>(
    () =>
      moments.map((m) => ({
        image: steamLibraryHeroLargeUrl(m.appid),
        palette,
        intensity: 0.9,
      })),
    [moments, palette]
  );
  useEffect(() => {
    const firstUrl = beatClaims[0]?.image;
    if (firstUrl) preloadLinkAsImage(firstUrl);
  }, [beatClaims]);
  const allUrls = useMemo(
    () => beatClaims.map((c) => c.image).filter((u): u is string => Boolean(u)),
    [beatClaims]
  );
  useAssetPreload(outerRef, allUrls);

  const BEAT_LAYOUT =
    "flex flex-col items-center justify-start [&>[data-band]]:!max-w-4xl [&>[data-band]]:!w-full [&>[data-band]]:!px-6 sm:[&>[data-band]]:!px-10 [&>[data-band]]:!pt-8 [&>[data-band]]:!pb-6";

  if (moments.length === 0) return null;

  const beatBodies: Array<(nudged: boolean) => ReactNode> = moments.map((m) => {
    return (nudged: boolean) => (
      <SteamMomentBeat
        appid={m.appid}
        name={m.name}
        daysSince={m.daysSince}
        slug={m.slug}
        momentType={m.momentType}
        firstTime={m.firstTime}
        cluster={m.cluster}
        nudged={nudged}
      />
    );
  });

  const masthead = <SteamMomentsAggregatorMasthead momentCount={moments.length} />;

  return (
    <div
      ref={outerRef}
      data-recap-chapter="steam-moments"
      // Editorial voice — matches the masthead's "what stuck this
      // season" framing rather than a flat "Steam highlights"
      // descriptor. Voice-led caret label like the Ahri chapter's "Try
      // to keep up" pattern.
      data-chapter-label="What stuck"
    >
      <ChapterMultiBeat
        slug="steam-moments"
        ariaLabel="Steam highlights"
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
