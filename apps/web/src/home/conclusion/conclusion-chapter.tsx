import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import type { AtmosphereClaim } from "@/home/atmosphere/use-atmosphere-claim";
import { usePrimaryAccount } from "@/home/use-primary-account";
import { rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import { formatRank } from "@vyoh/shared/lol/rank-history";

import { ChapterDetail, ChapterOpener, ChapterStats } from "../recap/chapter-bands";
import { ChapterMultiBeat } from "../recap/chapter-multi-beat";
import { useChapterGroupNudge } from "../recap/chapter-nudge-contexts";
import { ChapterReveal } from "../recap/chapter-reveal";
import {
  SHADOW_ACCENT,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
} from "../recap/chapter-shadows";
import { MultiBeat } from "../recap/multi-beat";
import { useAssetClaim } from "../recap/use-asset-claim";
import { EditorialCloser } from "./editorial-closer";
import { ConclusionFooterChips } from "./footer-chips";
import { LifetimeTotalsStrip } from "./lifetime-totals-strip";
import { NowPlayingStrip } from "./now-playing-strip";
import { RankTrajectoryStrip } from "./rank-trajectory-strip";
import { ConclusionRhythmBand } from "./rhythm-band";
import { TodayStrip } from "./today-strip";

/**
 * Conclusion chapter masthead — owner-as-subject identity slot. Closes
 * the page's "subject portrait" arc that opens with the Ahri chapter:
 * the page is a portrait, and the final brushstroke is the owner
 * themselves. Pattern parity with `AhriChapterMasthead` /
 * `SteamChapterTitleCard`: eyebrow + name-and-rank inline, masthead
 * "the player" italic.
 *
 * Two presence layers (same as every other subject masthead):
 * - `nudged` (live) — outer opacity fade for chapter transitions.
 * - `hasEntered` (one-shot) — latched ChapterReveal cascade so the
 *   blur-rise plays once on first entry, doesn't re-fire on
 *   backscroll.
 */
function ConclusionMasthead() {
  const { account } = usePrimaryAccount();
  const ddVersion = useDDragonVersion();
  const emblemYear = useRankedEmblemYear();
  const nudged = useChapterGroupNudge();
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => {
    if (nudged && !hasEntered) setHasEntered(true);
  }, [nudged, hasEntered]);

  if (!account) return null;
  const profileIconId = account.profileIconId;
  const rank = account.summary?.rank ?? null;

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
            {account.gameName}'s portrait
          </span>
          {rank ? (
            <>
              <span
                aria-hidden="true"
                className="text-foreground/40"
                style={{ textShadow: SHADOW_LABEL }}
              >
                ·
              </span>
              <span
                className="inline-flex items-center gap-1.5 text-foreground/75"
                style={{ textShadow: SHADOW_LABEL }}
              >
                <img
                  src={rankEmblemUrl(rank.tier, emblemYear)}
                  alt=""
                  className="size-4 object-contain"
                />
                {formatRank(rank.tier, rank.division, rank.leaguePoints)}
              </span>
            </>
          ) : null}
        </p>
      </ChapterReveal>
      <ChapterReveal active={hasEntered} delay={0.18} duration={1.1} blur={16} rise={20}>
        <Link
          to="/lol/$accountSlug"
          params={{ accountSlug: account.slug }}
          className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
        >
          <span className="inline-flex items-baseline gap-x-3">
            {profileIconId != null ? (
              <img
                src={profileIconUrl(profileIconId, ddVersion)}
                alt=""
                className="size-12 self-center rounded-full object-cover ring-1 ring-white/15 sm:size-14"
              />
            ) : null}
            <h2
              className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
              style={{ textShadow: SHADOW_MASTHEAD }}
            >
              {account.gameName}
            </h2>
          </span>
          <p
            className="text-base italic text-foreground/80 sm:text-lg"
            style={{ textShadow: SHADOW_LABEL }}
          >
            the player
          </p>
        </Link>
      </ChapterReveal>
    </motion.div>
  );
}

/**
 * Conclusion chapter (R-15). Closes the recap-arc page as a multi-beat
 * SUBJECT chapter about the owner — mirrors the Ahri chapter at the top
 * (champion-as-subject) with an owner-as-subject chapter at the bottom.
 * The page becomes "subject → subject → subject → SUBJECT (you)".
 *
 * Four beats reorganize the existing conclusion content:
 * - Beat 0: live presence + rhythm (NowPlayingStrip + ConclusionRhythmBand)
 *   — "how you play right now"
 * - Beat 1: rank trajectory + today (RankTrajectoryStrip + TodayStrip)
 *   — "where you stand"
 * - Beat 2: lifetime totals (LifetimeTotalsStrip)
 *   — "what you've sustained"
 * - Beat 3: editorial closer + footer chips (EditorialCloser +
 *   ConclusionFooterChips) — the page's sign-off + colophon
 *
 * Atmosphere claim: palette-only — the conclusion isn't "about" any
 * single subject image; the time-of-day palette carries the visual
 * register, and the per-beat content provides per-section identity.
 * Replaces the prior two snap-aligned siblings
 * (`conclusion-recent` + `conclusion-alltime`) that pre-dated R-13's
 * multi-beat primitive.
 *
 * `OwnerIdentityStrip` is dropped (was redundant with the new
 * chapter masthead which carries the owner's name + rank inline).
 */
export function ConclusionChapter() {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  const claim = useMemo<AtmosphereClaim>(() => ({ palette, intensity: 0.85 }), [palette]);
  useAssetClaim(outerRef, claim);

  const BEAT_LAYOUT =
    "flex flex-col items-center justify-start [&>[data-band]]:!max-w-4xl [&>[data-band]]:!w-full [&>[data-band]]:!px-6 sm:[&>[data-band]]:!px-10 [&>[data-band]]:!pt-8 [&>[data-band]]:!pb-6";

  // Beat bodies — render-prop pattern so per-beat `nudged` (from
  // <MultiBeat>) threads into the cascade if any beat needs it. The
  // strips here are mostly self-contained; nudged isn't yet wired into
  // each strip's internal reveals, polished in R-15.2.
  const beatBodies: Array<(nudged: boolean) => ReactNode> = [
    // Beat 0 — "How you play right now". Live presence + rhythm.
    () => (
      <>
        <ChapterOpener>
          <NowPlayingStrip />
          <ConclusionRhythmBand />
        </ChapterOpener>
      </>
    ),
    // Beat 1 — "Where you stand". 30-day rank trajectory + today pulse.
    () => (
      <ChapterDetail>
        <RankTrajectoryStrip />
        <TodayStrip />
      </ChapterDetail>
    ),
    // Beat 2 — "What you've sustained". Lifetime totals strip.
    () => (
      <ChapterStats>
        <LifetimeTotalsStrip />
      </ChapterStats>
    ),
    // Beat 3 — Page's pause + sign-off + colophon.
    () => (
      <ChapterDetail>
        <EditorialCloser />
        <ConclusionFooterChips />
      </ChapterDetail>
    ),
  ];

  return (
    <div ref={outerRef} data-recap-chapter="conclusion" data-chapter-label="The picture">
      <ChapterMultiBeat
        slug="conclusion"
        ariaLabel="The picture"
        identity={<ConclusionMasthead />}
      >
        {beatBodies.map((body, index) => (
          <MultiBeat
            // biome-ignore lint/suspicious/noArrayIndexKey: beat order is stable across renders within one chapter render pass
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
