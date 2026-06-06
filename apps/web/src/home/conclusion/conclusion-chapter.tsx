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
import { useSteamSummary } from "@/steam/use-steam-summary";
import { formatRank } from "@vyoh/shared/lol/rank-history";

import { BeatAccentSlash } from "../recap/beat-accent-slash";
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
  const { data: steam } = useSteamSummary();
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
  const steamAvatar = steam?.avatarUrl ?? null;
  const steamPersona = steam?.personaName ?? null;

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
          {steamPersona ? (
            <>
              <span
                aria-hidden="true"
                className="text-foreground/40"
                style={{ textShadow: SHADOW_LABEL }}
              >
                ·
              </span>
              <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
                {steamPersona} on Steam
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
            {/* Dual-platform identity: LoL summoner icon stacked
                slightly behind / left of the Steam avatar. Reads as
                one owner across two platforms rather than two
                separate accounts. -space-x style overlap brings the
                avatars together; the Steam avatar sits forward
                (z-index higher implicitly via DOM order) so it reads
                as the "newer" platform addition. Falls back to
                whichever single avatar is available. */}
            {profileIconId != null || steamAvatar ? (
              <span className="-space-x-3 flex shrink-0 items-center self-center">
                {profileIconId != null ? (
                  <img
                    src={profileIconUrl(profileIconId, ddVersion)}
                    alt=""
                    className="size-12 rounded-full object-cover ring-2 ring-background/80 sm:size-14"
                  />
                ) : null}
                {steamAvatar ? (
                  <img
                    src={steamAvatar}
                    alt=""
                    className="size-12 rounded-full object-cover ring-2 ring-background/80 sm:size-14"
                  />
                ) : null}
              </span>
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
  // Warm-amber accent — the conclusion's editorial "signature" tint.
  // Without an explicit accentHex, the conclusion would either inherit
  // a stale `--accent` from the prior chapter's claim (when proximity
  // weighting was still warming up) or fall back to the static-default
  // muted slate token (which reads as low-contrast purple on the dark
  // palette-only backdrop). Closer / sign-off register asks for a warm
  // tone, not the cool tones the chapter-subject accents tend to be.
  const ACCENT_HEX = "#f0c878";
  const claim = useMemo<AtmosphereClaim>(
    () => ({ palette, intensity: 0.85, accentHex: ACCENT_HEX }),
    [palette]
  );
  useAssetClaim(outerRef, claim);

  const BEAT_LAYOUT =
    "flex flex-col items-center justify-start [&>[data-band]]:!max-w-4xl [&>[data-band]]:!w-full [&>[data-band]]:!px-6 sm:[&>[data-band]]:!px-10 [&>[data-band]]:!pt-8 [&>[data-band]]:!pb-6";

  // Beat bodies — per-beat `nudged` (from <MultiBeat>) threads each
  // strip's entrance through `ChapterReveal` so content blur-rises in
  // when the beat becomes focal, matching the Ahri / Steam chapter
  // cascade vocabulary. The conclusion strips don't run their own
  // entrance animations (no CountUp / Sparkline draw), so wrapping
  // them top-level is the right granularity — nothing competes.
  //
  // Beat 0 also opens with a `BeatAccentSlash` from the left, mirroring
  // the page's opening Ahri chapter (slash-left on beat 0). Beat 3
  // deliberately omits its closing slash — `EditorialCloser` already
  // performs the chapter-close typographic gesture, and stacking a
  // slash on top would double-signal the sign-off.
  const beatBodies: Array<(nudged: boolean) => ReactNode> = [
    // Beat 0 — "How you play right now". Live presence + rhythm.
    (nudged) => (
      <ChapterOpener>
        <BeatAccentSlash
          beatIndex={0}
          delay={0.05}
          className="self-center"
          width="14rem"
        />
        <ChapterReveal active={nudged} delay={0.2}>
          <NowPlayingStrip />
        </ChapterReveal>
        <ChapterReveal active={nudged} delay={0.32} rise={16}>
          <ConclusionRhythmBand />
        </ChapterReveal>
      </ChapterOpener>
    ),
    // Beat 1 — "Where you stand". 30-day rank trajectory + today pulse.
    (nudged) => (
      <ChapterDetail>
        <ChapterReveal active={nudged} delay={0.05} rise={16}>
          <RankTrajectoryStrip />
        </ChapterReveal>
        <ChapterReveal active={nudged} delay={0.18}>
          <TodayStrip />
        </ChapterReveal>
      </ChapterDetail>
    ),
    // Beat 2 — "What you've sustained". Lifetime totals strip.
    (nudged) => (
      <ChapterStats>
        <ChapterReveal active={nudged} delay={0.05} rise={16}>
          <LifetimeTotalsStrip />
        </ChapterReveal>
      </ChapterStats>
    ),
    // Beat 3 — Page's pause + sign-off + colophon. No closing slash:
    // `EditorialCloser` already carries the chapter-close gesture.
    (nudged) => (
      <ChapterDetail>
        <ChapterReveal active={nudged} delay={0.05} rise={16} blur={4}>
          <EditorialCloser />
        </ChapterReveal>
        <ChapterReveal active={nudged} delay={0.22}>
          <ConclusionFooterChips />
        </ChapterReveal>
      </ChapterDetail>
    ),
  ];

  return (
    <div
      ref={outerRef}
      data-recap-chapter="conclusion"
      data-chapter-label="The picture"
      // The route page (apps/web/src/routes/__root.tsx) wraps all chapter
      // content in a `mx-auto max-w-4xl p-6` container. That p-6 includes
      // 24px of BOTTOM padding, which leaves a 24px gap between the
      // conclusion section's bottom and main's scrollable bottom edge.
      // CSS sticky disengages from `top: 0` when the section's bottom
      // approaches the viewport's bottom — and that 24px gap is exactly
      // where the disengagement plays out as a visible ~24-30px content
      // scroll-up at chapter exit. The `-mb-6` negative bottom margin
      // pulls the section into the wrapper's bottom padding region so
      // section.bottom coincides with main's scrollable bottom edge,
      // keeping sticky pinned all the way to the page's natural end.
      className="-mb-6"
    >
      <ChapterMultiBeat
        slug="conclusion"
        ariaLabel="The picture"
        identity={<ConclusionMasthead />}
        // Lower scroll runway (1.3 vs the 2.3 default) — the conclusion
        // is the last chapter, so the generous default runway just
        // produces post-arrival empty scroll where nothing changes.
        // Edge dwell stays at the default 3 units: zero-dwell was a
        // mid-arc attempt to compensate for the visible content-slide
        // at chapter exit, but `-mb-6` below is the actual fix for
        // that. With edge dwell at zero, beat 0 starts translating
        // horizontally the instant the chapter enters (no entrance
        // buffer) and beat 3's pin-range gate (`section.bottom >=
        // main.bottom` inside `editorial-chrome.tsx`) flips off
        // immediately at scrollYProgress=1, hiding the beat indicator
        // before the user has stopped scrolling.
        scrollRunwayMultiplier={1.3}
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
