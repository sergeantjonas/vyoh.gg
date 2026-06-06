import { Link } from "@tanstack/react-router";
import type {
  RecapChapterFraming,
  SteamGameRecap,
  SteamStandoutUnlock,
  SteamUnlock,
} from "@vyoh/shared";
import {
  formatPlaytime,
  formatReleaseDateChip,
  verdictParagraphSteam,
} from "@vyoh/shared";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { motion } from "motion/react";

import { CountUp } from "@/components/count-up";
import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { STEAM_FEATURED_APPID } from "@/home/landing-config";
import {
  steamAchievementIconUrl,
  steamLibraryHeroLargeUrl,
  steamLibraryLogoUrl,
  steamPageBackgroundUrl,
} from "@/steam/_shared/steam-image";
import { useSteamGameRecap } from "@/steam/use-steam-game-recap";

import { BeatAccentSlash } from "./beat-accent-slash";
import {
  ChapterCloser,
  ChapterDetail,
  ChapterOpener,
  ChapterStats,
} from "./chapter-bands";
import { ChapterBeat } from "./chapter-beat";
import { ChapterGroup, useChapterGroupNudge } from "./chapter-group";
import { ChapterMultiBeat } from "./chapter-multi-beat";
import { ChapterReveal } from "./chapter-reveal";
import {
  SHADOW_ACCENT,
  SHADOW_BODY,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
} from "./chapter-shadows";
import { MultiBeat } from "./multi-beat";
import { parseAnimatableNumber } from "./parse-animatable-number";
import { preloadLinkAsImage } from "./preload-link";
import { SteamChapterCloserMedia } from "./steam-chapter-closer-media";
import { UnlocksPerWeekBand } from "./unlocks-per-week-band";
import { useAssetClaim } from "./use-asset-claim";
import { useAssetPreload } from "./use-asset-preload";
import { useMultiBeatFlag } from "./use-multi-beat-flag";
import { VerdictProse } from "./verdict-prose";

// Bucket-aware kicker copy. Mirrors the arc note's "Steam framing" table —
// the page never lies about recency, so the eyebrow flips honestly with the
// owner's actual last-play age. Null bucket (no last-played timestamp ever)
// degrades to a static "STEAM" so the kicker still has a register.
const EYEBROW_FOR_BUCKET: Record<NonNullable<SteamGameRecap["ageBucket"]>, string> = {
  current: "Playing lately",
  recent: "Recently into",
  season: "This season on",
  year: "Earlier this year",
};

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
 * Extract the editorial subtitle from a Steam short description. The full
 * blurb is multiple sentences separated by `\r\n\r\n` paragraphs — we want
 * just the first sentence's worth so the masthead doesn't drown under a
 * marketing paragraph. Falls back to the empty string when nothing parses.
 */
function firstSentence(short: string | null): string {
  if (!short) return "";
  // Take everything up to the first paragraph break.
  const para = short.split(/\r?\n\r?\n/)[0] ?? short;
  // Then up to the first sentence terminator. Period is fine; "!" and "?"
  // are rare on Steam taglines but cheap to support.
  const match = para.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? para).trim();
}

/**
 * Standout-unlock receipt — the chapter's editorial "this is the moment that
 * proves the verdict". Bare typographic block (no chrome) so it reads as
 * magazine spread, not UI module. Frames as "rarest" when rarity data
 * places the unlock in the top tier; otherwise softens to "latest milestone".
 */
function StandoutUnlockBlock({
  appid,
  standout,
}: {
  appid: number;
  standout: SteamStandoutUnlock;
}) {
  const rarity =
    standout.globalPercent !== null && standout.globalPercent <= 25
      ? standout.globalPercent
      : null;
  // Single decimal for sub-10% rarities (1.8% reads as editorial weight, "2%"
  // erases it); integer otherwise (12% reads cleaner than 12.4%).
  const rarityLabel =
    rarity !== null
      ? rarity < 10
        ? `${rarity.toFixed(1)}% have it`
        : `${Math.round(rarity)}% have it`
      : null;
  return (
    <Link
      to="/steam/game/$appid"
      params={{ appid: String(appid) }}
      search={{ ach: standout.apiName }}
      // Bare editorial block — no border, no backdrop. Negative inline-x
      // margin + matching padding gives a hover band without painting a
      // permanent card edge. Larger sizes than the prior pin layout since
      // the standout now owns its own viewport in beat 1.
      className="group -mx-3 flex cursor-pointer items-start gap-5 rounded-md px-3 py-2 transition-colors hover:bg-black/25 sm:gap-6"
    >
      <img
        src={steamAchievementIconUrl(appid, standout.apiName)}
        alt=""
        loading="lazy"
        className="size-20 shrink-0 rounded-md ring-1 ring-white/15 sm:size-24"
      />
      <div className="flex min-w-0 flex-col gap-2">
        <span
          className="text-xs uppercase tracking-[0.2em] text-foreground/80 sm:text-sm"
          style={{ textShadow: SHADOW_BODY }}
        >
          {rarity !== null ? "Rarest milestone" : "Latest milestone"}
        </span>
        <span
          className="text-3xl font-semibold leading-tight text-foreground sm:text-5xl"
          style={{ textShadow: SHADOW_MASTHEAD }}
        >
          {standout.displayName}
        </span>
        {/* Description gives the achievement its narrative weight — "Bandit"
            alone is opaque, "Steal 80% of the gold from a Merchant" tells the
            visitor what was actually pulled off. Hidden achievements skip the
            description: Steam's spoiler protection exists for a reason
            (story-locked unlocks describe plot beats), and the chapter is
            publicly readable so a visitor browsing the page shouldn't be
            spoiled. */}
        {!standout.hidden && standout.description ? (
          <p
            className="text-base text-foreground/85 sm:text-lg"
            style={{ textShadow: SHADOW_BODY }}
          >
            {standout.description}
          </p>
        ) : null}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/85 sm:text-base"
          style={{ textShadow: SHADOW_BODY }}
        >
          {rarityLabel ? (
            <>
              <span className="tabular-nums">{rarityLabel}</span>
              <span aria-hidden="true" className="text-foreground/40">
                ·
              </span>
            </>
          ) : null}
          <span>{standout.daysAgo === 0 ? "today" : `${standout.daysAgo}d ago`}</span>
          <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
            open →
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Recent-unlocks row — mirrors the Ahri chapter's recent-matches strip.
 * Identity column (icon + name) hugs left, meta column (rarity · relative
 * date) hugs right with shrink-0; separator goes between peer meta fields,
 * not stranded between identity and meta.
 */
function RecentUnlockRow({
  appid,
  unlock,
}: {
  appid: number;
  unlock: SteamUnlock;
}) {
  const rarityChip =
    unlock.globalPercent !== null
      ? unlock.globalPercent < 10
        ? `${unlock.globalPercent.toFixed(1)}%`
        : `${Math.round(unlock.globalPercent)}%`
      : null;
  return (
    <Link
      to="/steam/game/$appid"
      params={{ appid: String(appid) }}
      search={{ ach: unlock.apiName }}
      className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-foreground/95 transition-colors hover:bg-black/25 hover:text-foreground"
      style={{ textShadow: SHADOW_BODY }}
    >
      <img
        src={steamAchievementIconUrl(appid, unlock.apiName)}
        alt=""
        loading="lazy"
        className="size-6 shrink-0 rounded ring-1 ring-white/15"
      />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground/95">
        {unlock.displayName}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-foreground/80 group-hover:text-foreground/95">
        {rarityChip ? (
          <>
            <span className="tabular-nums">{rarityChip}</span>
            <span aria-hidden="true" className="text-foreground/40">
              ·
            </span>
          </>
        ) : null}
        <span>{formatRelative(unlock.unlockedAt)}</span>
      </span>
    </Link>
  );
}

/**
 * Peak chip — reuses the Ahri primitive verbatim. Parses pre-formatted
 * display values back to numeric targets so each chip can count up;
 * em-dash zero-states and compound shapes fall through to static render
 * via `parseAnimatableNumber`.
 */
function PeakChip({
  active,
  delay,
  label,
  value,
}: {
  active: boolean;
  delay: number;
  label: string;
  value: string;
}) {
  const parsed = parseAnimatableNumber(value);
  // Reserve width for the count-up's FINAL digit count so the suffix
  // doesn't get pushed around as digits grow during the animation. With
  // tabular-nums each digit is the same width, but the total string
  // width still grows by one column per added digit — "0" → "10" → "100"
  // shifts the % sign right with each step. min-width: Nch (where N
  // matches the final value's character count, including any decimal
  // point) reserves a fixed-width box; right-align fills from the
  // right so the rightmost digit + suffix stay anchored.
  const reservedChars = parsed
    ? String(Math.floor(parsed.raw)).length +
      (parsed.decimals > 0 ? 1 + parsed.decimals : 0)
    : 0;
  return (
    // Scale-in pop + larger rise gives chips a "tile settling into place"
    // character distinct from the prose-tier fade+rise the verdict and
    // standout block use. scale=0.86 is below the conservative 0.92 floor
    // because chips have no body text whose readability suffers from a
    // bigger start-state.
    <ChapterReveal active={active} delay={delay} scale={0.86} rise={24} duration={0.7}>
      <div className="flex flex-col gap-2 sm:gap-3">
        <span
          // text-5xl ≈ 48px, sm:text-6xl ≈ 60px. Sized down from the
          // earlier text-6xl/text-8xl after owner flagged the numbers as
          // oversized AND the min-width count-up reservation made three
          // chips at text-8xl wrap on common viewport widths.
          className="text-5xl font-semibold leading-none tabular-nums text-foreground sm:text-6xl"
          style={{ textShadow: SHADOW_MASTHEAD }}
        >
          {parsed ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  minWidth: `${reservedChars}ch`,
                  textAlign: "right",
                }}
              >
                <CountUp
                  to={parsed.raw}
                  decimals={parsed.decimals}
                  start={active}
                  delay={delay + 0.7}
                />
              </span>
              {parsed.suffix}
            </>
          ) : (
            value
          )}
        </span>
        <span
          className="text-xs font-medium uppercase tracking-[0.25em] text-foreground/75 sm:text-sm"
          style={{ textShadow: SHADOW_LABEL }}
        >
          {label}
        </span>
      </div>
    </ChapterReveal>
  );
}

/**
 * Persistent title card for the Steam chapter — eyebrow + masthead +
 * tagline rendered inside `<ChapterGroup>`'s `identity` slot. Sticks at
 * the top of the chapter group and stays visible across every beat.
 * Beat content lives in the area below.
 *
 * This is the chapter's editorial constant: when the reader scrolls
 * from beat 0 (verdict) to beat 1 (recent moments), the masthead
 * doesn't disappear or shrink — it stays anchored as the new content
 * arrives underneath. The "one masthead, content changes around it"
 * pattern owner specified.
 */
function SteamChapterTitleCard({
  name,
  eyebrow,
  releaseChip,
  tagline,
  hasLogo,
  appid,
  assetTimestamp,
}: {
  name: string;
  eyebrow: string;
  releaseChip: string | null;
  tagline: string;
  hasLogo: boolean;
  appid: number;
  assetTimestamp: number | null;
}) {
  // Two layers of presence:
  // - `nudged` (live): true while chapter is entered and not exiting.
  //   Drives a fast outer opacity fade for exit + re-entry transitions.
  // - `hasEntered` (one-shot): flips true the first time nudged goes
  //   true, never resets. Drives the per-element ChapterReveal cascade
  //   so the editorial blur-rise plays once at first entry and doesn't
  //   re-run on every re-entry (which would lag behind a quick back-
  //   scroll — the masthead reveal alone is 0.18+1.1=1.28s).
  const nudged = useChapterGroupNudge();
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => {
    if (nudged && !hasEntered) setHasEntered(true);
  }, [nudged, hasEntered]);
  return (
    <motion.div
      initial={false}
      animate={{ opacity: nudged ? 1 : 0 }}
      // 0.2s is short enough that the title card fully fades in during a
      // typical back-scroll pause on the last beat. The previous 0.4s
      // hadn't completed when the reader continued to the next beat back,
      // so the card visually "appeared" one beat later than the trigger.
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
            {eyebrow}
          </span>
          {releaseChip ? (
            <>
              <span
                aria-hidden="true"
                className="text-foreground/40"
                style={{ textShadow: SHADOW_LABEL }}
              >
                ·
              </span>
              <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
                {releaseChip}
              </span>
            </>
          ) : null}
        </p>
      </ChapterReveal>
      <ChapterReveal active={nudged} delay={0.18} duration={1.1} blur={16} rise={20}>
        <Link
          to="/steam/game/$appid"
          params={{ appid: String(appid) }}
          className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-end gap-x-4 gap-y-2 rounded-md transition-opacity hover:opacity-95"
        >
          {hasLogo && assetTimestamp !== null ? (
            <img
              src={steamLibraryLogoUrl(appid, assetTimestamp)}
              alt={name}
              className="max-h-[14dvh] w-auto max-w-full object-contain sm:max-h-[18dvh]"
              style={{
                filter:
                  "drop-shadow(0 1px 0 rgba(0,0,0,0.9)) drop-shadow(0 0 6px rgba(0,0,0,0.85)) drop-shadow(0 2px 16px rgba(0,0,0,0.6))",
              }}
            />
          ) : (
            <h2
              className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
              style={{ textShadow: SHADOW_MASTHEAD }}
            >
              {name}
            </h2>
          )}
          {tagline ? (
            <p
              className="text-base italic text-foreground/80 sm:text-lg"
              style={{ textShadow: SHADOW_LABEL }}
            >
              {tagline}
            </p>
          ) : null}
        </Link>
      </ChapterReveal>
    </motion.div>
  );
}

/**
 * Standout-unlock receipt scaled up for stacked-beat layout — beat 1 owns
 * a full viewport, so the standout block becomes the hero. Larger icon,
 * larger displayName, more breathing room.
 */

/**
 * Steam subject chapter (R-3). Second chapter type, hardcoded to the appid
 * in `STEAM_FEATURED_APPID` until R-4's `useChapters()` selection logic
 * lands and drives chapter ordering off real activity scores.
 *
 * Mirrors the Ahri chapter (R-2) structure faithfully — same pin window,
 * same reveal cascade timings, same shadow tiers, same paint-order accent
 * outline, same dark-hover bands. Different content: game name + tagline
 * instead of champion + title, standout-unlock receipt instead of signature
 * game, recent unlocks instead of recent matches, screenshot strip instead
 * of a CTA-only closer.
 */
export function SteamChapter({
  appid = STEAM_FEATURED_APPID,
  framing,
  priority = "lazy",
}: {
  appid?: number;
  framing?: RecapChapterFraming | null;
  /**
   * "critical" → splash gets a `<link rel="preload">` the moment its URL
   * resolves, so the asset is in cache before the user scrolls into the
   * chapter. Reserved for the first algorithmic chapter (one past the
   * Ahri anchor) per the recap arc's R-9 budget. "lazy" (default) gates
   * the preload on viewport proximity via `useAssetPreload`.
   */
  priority?: "critical" | "lazy";
} = {}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const recapQuery = useSteamGameRecap(appid);
  const recap = recapQuery.data;

  // Static library-hero splash — no rotation (the Ahri-skin auto-cycle is
  // skin-specific to LoL; Steam's hero image is one canonical asset per
  // game). Screenshots live in the closer band as a strip, not as a
  // backdrop rotator. Falls back to the page-background scenic variant
  // when `library_hero.jpg` is missing (~9% of pre-2019 titles).
  const splashUrl = useMemo(() => {
    if (!recap) return null;
    return recap.hasLibraryHero
      ? steamLibraryHeroLargeUrl(recap.appid, recap.assetTimestamp, recap.flipHero)
      : steamPageBackgroundUrl(recap.appid, recap.assetTimestamp, recap.flipHero);
  }, [recap]);

  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  const accentHex = recap?.dominantHex ?? null;
  // Subject anchor: face-detected focal point of `library_hero.jpg`. Passes
  // through to the atmosphere layer's `object-position` so the focal subject
  // (Leon's face on RE4, character portraits on similar art-direction)
  // stays visible under viewport-cover instead of being sliced by the crop.
  // Both null → atmosphere layer defaults to "center" (no-op equivalent).
  const subjectXPercent = recap?.subjectXPercent ?? null;
  const subjectYPercent = recap?.subjectYPercent ?? null;
  const claim = useMemo(
    () => ({
      ...(splashUrl !== null ? { image: splashUrl } : {}),
      palette,
      ...(accentHex !== null ? { accentHex } : {}),
      subjectXPercent,
      subjectYPercent,
    }),
    [splashUrl, palette, accentHex, subjectXPercent, subjectYPercent]
  );
  useAssetClaim(outerRef, claim);

  // R-9 splash preload. Critical chapters (first algorithmic chapter, one
  // past the Ahri anchor) inject `<link rel="preload">` the moment the URL
  // resolves so the asset enters the browser's preload queue ahead of any
  // script-created Image() fetches. Lazy chapters gate on viewport
  // proximity via `useAssetPreload` so their assets don't compete with
  // the critical-path hero during initial page load.
  useEffect(() => {
    if (priority !== "critical") return;
    return preloadLinkAsImage(splashUrl);
  }, [priority, splashUrl]);
  useAssetPreload(outerRef, priority === "lazy" ? [splashUrl] : []);

  // Defaults so the chapter layout always has *something* to render — the
  // empty-state copy line from verdictParagraphSteam handles the
  // never-played edge structurally without a separate unmount path.
  const name = framing?.title ?? recap?.name ?? "";
  const tagline = useMemo(() => firstSentence(recap?.shortDescription ?? null), [recap]);
  const eyebrow =
    framing?.eyebrow ??
    (recap?.ageBucket ? EYEBROW_FOR_BUCKET[recap.ageBucket] : "Steam");
  // Released-when chip — supplementary metadata next to the eyebrow. Pure
  // string from the shared helper so the register matches across chapters.
  const releaseChip = useMemo(
    () => formatReleaseDateChip(recap?.releaseDate ?? null),
    [recap?.releaseDate]
  );
  const standout = recap?.standoutUnlock ?? null;
  const recentUnlocks = recap?.recentUnlocks ?? [];
  const unlocksPerWeek = recap?.unlocksPerWeek ?? [];
  const screenshots = recap?.screenshots ?? [];
  const completionPct = recap?.completionPct ?? null;
  const playtime2WeekMin = recap?.playtime2WeeksMinutes ?? null;
  const playtimeForeverMin = recap?.playtimeForeverMinutes ?? 0;
  const standoutGlobalPercent = standout?.globalPercent ?? null;

  const verdictClauses = useMemo(
    () => (recap ? verdictParagraphSteam(recap) : []),
    [recap]
  );

  // Layout class for each beat's content wrapper. Horizontal padding +
  // flex direction only — vertical positioning is handled by ChapterGroup's
  // sticky stage (beats render in the absolute layer positioned below
  // the masthead at `top: 30vh`). Adding pt here would push content
  // further down on top of that offset.
  const useMultiBeat = useMultiBeatFlag();
  // Multi-beat path: beats are viewport-wide (full-bleed), so center the
  // band content within each beat via a `max-w-4xl` reading column. Also
  // override the band's default `pt-12`/`pb-12` "breathing room" (from
  // chapter-bands.tsx, intended for stacked bands) to a tighter
  // `pt-6`/`pb-6` since beats no longer stack vertically. Legacy path
  // unaffected.
  const BEAT_LAYOUT = useMultiBeat
    ? "flex flex-col items-center justify-start px-6 sm:px-10 [&>[data-band]]:!max-w-4xl [&>[data-band]]:!pt-8 [&>[data-band]]:!pb-6"
    : "flex flex-col items-start justify-start px-6 sm:px-10";

  // Beat bodies extracted as render-prop functions so both the legacy
  // ChapterGroup path and the multi-beat ChapterMultiBeat path can map
  // over the same source without duplicating ~150 lines of JSX.
  // Removing this temporary indirection: see chunk 4 of
  // [multi-beat-chapter-arc.md](../../../docs/working-notes/cross-cutting/multi-beat-chapter-arc.md).
  const beatBodies: Array<(nudged: boolean) => ReactNode> = [
    // Beat 0 — Verdict prose with editorial slash mark. The splash
    // already carries its own atmospheric depth (rain, light, mood on
    // the Steam hero), so beat 0 stays restrained: an accent slash
    // sweep-in above the prose, then the prose itself with the R-2
    // ChapterReveal blur+rise cascade. An earlier pass added a depth-1
    // ambient radial wash for "≥3 layers" — pulled in the first review:
    // the wash either washed out the splash (at higher opacity) or
    // disappeared (at lower), with no comfortable middle. Same
    // rejection the R-2 spec applied to "localized backdrop-filter
    // behind accent text" and for the same reason.
    //
    // Under reduced motion / outside multi-beat context, the slash
    // renders at its in-place rest position without animation, and the
    // ChapterReveal cascade fires statically.
    (nudged) => (
      <ChapterOpener>
        {verdictClauses.length > 0 ? (
          <div className="flex w-full flex-col">
            {/* Accent slash — magazine opener mark above the prose.
                Mirrors beat 3's closer slash, which sits below its
                content with `from="right"`; together the two
                slashes bookend the chapter. Animates FIRST as an
                editorial kicker: the slash draws in (delay 0.05s),
                lands at ~0.75s, then the prose blur-rise follows
                beneath it. This sequencing matches its role — an
                opener mark sets up the headline / body that
                follows, the same way a magazine kicker line
                precedes its lede. */}
            <BeatAccentSlash
              beatIndex={0}
              delay={0.05}
              className="mb-3 sm:mb-4"
              width="14rem"
            />

            {/* Verdict prose — curtain-pull entrance: bigger rise +
                blur + longer duration than the band default. Delay
                bumped past the slash's draw so the prose lands
                second, after the kicker has set the stage. */}
            <ChapterReveal active={nudged} delay={0.8} blur={8} rise={22} duration={0.9}>
              <VerdictProse
                clauses={verdictClauses}
                style={{ textShadow: SHADOW_BODY }}
                emphasisStyle={{
                  paintOrder: "stroke",
                  WebkitTextStroke: STROKE_ACCENT,
                  textShadow: SHADOW_ACCENT,
                }}
                numbersActive={nudged}
                numbersDelay={1.85}
              />
            </ChapterReveal>
          </div>
        ) : null}
      </ChapterOpener>
    ),

    // Beat 1 — Recent moments (standout + recent unlocks).
    (nudged) => (
      <>
        <ChapterDetail>
          {standout ? (
            // Focal card lands from the left with a slight settle-in
            // pop. The standout achievement is the visual anchor of
            // beat 1; the directional entrance gives it weight and
            // distinguishes it from the cascade of recent unlocks
            // that follows from the opposite side.
            <ChapterReveal
              active={nudged}
              delay={0.05}
              slideX={-40}
              scale={0.96}
              duration={0.75}
            >
              <StandoutUnlockBlock appid={appid} standout={standout} />
            </ChapterReveal>
          ) : null}

          {recentUnlocks.length > 0 ? (
            <div className="flex flex-col gap-2 pt-2">
              {/* Sparkline header band — unlocks-per-week trailing
                  cadence (right-anchored at the current Brussels week,
                  oldest-first, adaptive window up to 12 weeks). The
                  band lands a hair before the "Recent unlocks" heading
                  so the reader has scanned the trend by the time the
                  feed rows start cascading in. Hidden entirely when
                  the deriver returns fewer than 2 weeks of data — a
                  single-point line has no shape. */}
              {unlocksPerWeek.length >= 2 ? (
                <ChapterReveal active={nudged} delay={0.16}>
                  <UnlocksPerWeekBand data={unlocksPerWeek} />
                </ChapterReveal>
              ) : null}
              <ChapterReveal active={nudged} delay={0.2}>
                <h3
                  className="text-[10px] uppercase tracking-[0.2em] text-foreground/80"
                  style={{ textShadow: SHADOW_BODY }}
                >
                  Recent unlocks
                </h3>
              </ChapterReveal>
              <ul className="flex flex-col gap-0.5">
                {recentUnlocks.map((u, i) => (
                  <li key={u.apiName}>
                    {/* Rows cascade in from the right opposite the
                              standout block. Tighter stagger (0.045) than
                              the prior 0.06 — reads as a feed pulling in,
                              not a list being drawn one row at a time. */}
                    <ChapterReveal active={nudged} delay={0.28 + i * 0.045} slideX={18}>
                      <RecentUnlockRow appid={appid} unlock={u} />
                    </ChapterReveal>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </ChapterDetail>
      </>
    ),

    // Beat 2 — Stats (chunk 3 expands this with new stats).
    (nudged) => (
      <>
        <ChapterStats>
          <PeakChip
            active={nudged}
            delay={0.08}
            label="Completion"
            value={completionPct !== null ? `${Math.round(completionPct * 100)}%` : "—"}
          />
          <PeakChip
            active={nudged}
            delay={0.22}
            label="Two weeks"
            value={
              playtime2WeekMin !== null && playtime2WeekMin > 0
                ? formatPlaytime(playtime2WeekMin)
                : playtimeForeverMin > 0
                  ? formatPlaytime(playtimeForeverMin)
                  : "—"
            }
          />
          <PeakChip
            active={nudged}
            delay={0.36}
            label={standoutGlobalPercent !== null ? "Rarest unlock" : "Unlocks"}
            value={
              standoutGlobalPercent !== null
                ? standoutGlobalPercent < 10
                  ? `${standoutGlobalPercent.toFixed(1)}%`
                  : `${Math.round(standoutGlobalPercent)}%`
                : recap
                  ? `${recap.achievementsUnlocked}`
                  : "—"
            }
          />
        </ChapterStats>
      </>
    ),

    // Beat 3 — Closer (SteamChapterCloserMedia slot + mirror accent
    // slash). Closer is an edge beat (last in the chapter), so the
    // composition mirrors beat 0's structure rotated 180°: the focal
    // content (here, the screenshot strip) lands first, then the
    // accent slash signs off the chapter from the RIGHT edge —
    // mirroring beat 0's left-to-right slash. The mirroring signals
    // "magazine spread close" in the same visual vocabulary as the
    // opener without templating the two beats identically.
    //
    // R-10 trailer substrate also lands inside SteamChapterCloserMedia
    // without touching this JSX.
    (nudged) => (
      <ChapterCloser>
        <div className="flex w-full flex-col gap-5">
          <SteamChapterCloserMedia
            appid={appid}
            screenshots={screenshots}
            active={nudged}
          />
          {/* Mirror accent slash — `from="right"` draws right-to-left,
              mirroring beat 0's left-anchored slash. `self-end` aligns
              it to the right edge of the reading column. Delay tuned
              to land after the screenshot strip's per-thumb stagger
              settles (~5 thumbs at 0.08s stagger + 0.6s reveal). */}
          <BeatAccentSlash
            beatIndex={3}
            from="right"
            delay={1.1}
            className="self-end"
            width="14rem"
          />
        </div>
      </ChapterCloser>
    ),
  ];

  const titleCard = (
    <SteamChapterTitleCard
      name={name}
      eyebrow={eyebrow}
      releaseChip={releaseChip}
      tagline={tagline}
      hasLogo={recap?.hasLogo ?? false}
      appid={appid}
      assetTimestamp={recap?.assetTimestamp ?? null}
    />
  );

  if (useMultiBeat) {
    return (
      <div
        ref={outerRef}
        data-recap-chapter="steam"
        data-steam-appid={appid}
        data-chapter-label={name || `Steam game ${appid}`}
      >
        <ChapterMultiBeat
          slug={`steam-${appid}`}
          ariaLabel={name || `Steam game ${appid}`}
          identity={titleCard}
        >
          {beatBodies.map((body, index) => (
            <MultiBeat
              // biome-ignore lint/suspicious/noArrayIndexKey: beat order is stable across renders
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

  return (
    <div
      ref={outerRef}
      data-recap-chapter="steam"
      data-steam-appid={appid}
      data-chapter-label={name || `Steam game ${appid}`}
    >
      <ChapterGroup
        slug={`steam-${appid}`}
        ariaLabel={name || `Steam game ${appid}`}
        identity={titleCard}
      >
        {beatBodies.map((body, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: beat order is stable across renders
          <ChapterBeat key={index} index={index} className={BEAT_LAYOUT}>
            {body}
          </ChapterBeat>
        ))}
      </ChapterGroup>
    </div>
  );
}
