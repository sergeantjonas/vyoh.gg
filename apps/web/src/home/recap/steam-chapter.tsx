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
import { useEffect, useMemo, useRef } from "react";

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

import {
  ChapterCloser,
  ChapterDetail,
  ChapterOpener,
  ChapterStats,
} from "./chapter-bands";
import { ChapterBeat, ChapterBeats, useActiveBeat } from "./chapter-beats";
import { ChapterContainer } from "./chapter-container";
import { ChapterReveal } from "./chapter-reveal";
import {
  SHADOW_ACCENT,
  SHADOW_BODY,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
} from "./chapter-shadows";
import { parseAnimatableNumber } from "./parse-animatable-number";
import { preloadLinkAsImage } from "./preload-link";
import { SteamChapterCloserMedia } from "./steam-chapter-closer-media";
import { SteamChapterIdentityStrip } from "./steam-chapter-identity-strip";
import { useAssetClaim } from "./use-asset-claim";
import { useAssetPreload } from "./use-asset-preload";
import { useChapterNudge } from "./use-chapter-nudge";
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
      // Bare editorial block per the Ahri chapter's SignatureGameBlock —
      // no border, no backdrop. Negative inline-x margin + matching padding
      // gives a hover band without painting a permanent card edge.
      className="group -mx-3 flex cursor-pointer items-start gap-4 rounded-md px-3 py-2 transition-colors hover:bg-black/25"
    >
      <img
        src={steamAchievementIconUrl(appid, standout.apiName)}
        alt=""
        loading="lazy"
        className="size-16 shrink-0 rounded-md ring-1 ring-white/15"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className="text-[10px] uppercase tracking-[0.2em] text-foreground/80"
          style={{ textShadow: SHADOW_BODY }}
        >
          {rarity !== null ? "Rarest milestone" : "Latest milestone"}
        </span>
        <span
          className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl"
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
            spoiled. Owner can always click through to the game-detail page
            for the full unlocked-spoilers view. */}
        {!standout.hidden && standout.description ? (
          <p
            // Description-line stays at text-sm even on larger viewports —
            // sm:text-base added a line of vertical content that pushed
            // the chapter's bottom band (screenshots + CTA) out of the
            // 1-viewport pin. The description is supporting prose; the
            // displayName above carries the editorial weight.
            className="text-foreground/85 text-sm"
            style={{ textShadow: SHADOW_BODY }}
          >
            {standout.description}
          </p>
        ) : null}
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/85"
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
  return (
    <ChapterReveal active={active} delay={delay}>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
          style={{ textShadow: SHADOW_BODY }}
        >
          {parsed ? (
            <>
              <CountUp
                to={parsed.raw}
                decimals={parsed.decimals}
                start={active}
                delay={delay + 0.7}
              />
              {parsed.suffix}
            </>
          ) : (
            value
          )}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.2em] text-foreground/70"
          style={{ textShadow: SHADOW_LABEL }}
        >
          {label}
        </span>
      </div>
    </ChapterReveal>
  );
}

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

  // Polite one-shot nudge into the chapter pin — see `useChapterNudge` for
  // the threshold + settle tuning notes.
  const nudged = useChapterNudge(outerRef);

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

  const verdictClauses = useMemo(
    () => (recap ? verdictParagraphSteam(recap) : []),
    [recap]
  );

  return (
    <div
      ref={outerRef}
      data-recap-chapter="steam"
      data-steam-appid={appid}
      data-chapter-label={name || `Steam game ${appid}`}
      // Native CSS snap point. Combined with `scroll-snap-type: y mandatory`
      // on <main>, the browser pulls the chapter top to viewport top on
      // every scroll-end, both directions. `scroll-snap-stop: always`
      // prevents momentum scrolls from skipping past the chapter — the
      // book-like page-turn feel needs both: mandatory makes the resting
      // state clean, `stop: always` makes traversal exhaustive.
      className="[scroll-snap-align:start] [scroll-snap-stop:always]"
    >
      <ChapterContainer
        beats={4}
        slug={`steam-${appid}`}
        ariaLabel={name || `Steam game ${appid}`}
        // pt clears the persistent identity strip rendered at the top of
        // the pin (~24px from top, ~32px tall = ~56px total). pt-20/24
        // leaves comfortable breathing room and pushes beat 0's masthead
        // down by a corresponding amount; the masthead is large enough
        // to absorb that shift without losing editorial weight.
        pinClassName="items-start justify-start px-6 pt-20 sm:px-10 sm:pt-24"
      >
        <SteamChapterIdentityStrip
          name={name}
          hasLogo={recap?.hasLogo ?? false}
          appid={appid}
          assetTimestamp={recap?.assetTimestamp ?? null}
        />
        <ChapterBeats>
          <SteamChapterBeats
            nudged={nudged}
            appid={appid}
            name={name}
            eyebrow={eyebrow}
            releaseChip={releaseChip}
            tagline={tagline}
            recap={recap}
            verdictClauses={verdictClauses}
          />
        </ChapterBeats>
      </ChapterContainer>
    </div>
  );
}

/**
 * Beat-aware body of `SteamChapter`. Lives inside `<ChapterBeats>` so it
 * can read the active-beat index via `useActiveBeat()` and gate each
 * beat's reveal cascade on its own activation, rather than threading one
 * chapter-wide `nudged` signal through every band. The four-beat
 * partition mirrors the historical single-pin band stack:
 *
 *   0. Identity      — eyebrow + masthead/logo + tagline + verdict
 *   1. Recent moments — standout unlock + recent-unlocks strip
 *   2. Stats         — peak chips (R-13 chunk 3 adds new stats here)
 *   3. Closer        — `<SteamChapterCloserMedia>` slot
 *
 * Reveal delays are reset per beat (≈ 0.05–0.25) — the prior cumulative
 * 0.05 → 1.5 cascade was sized for a single pin where everything was
 * visible at once. Under multi-beat, each beat earns its own cascade
 * starting near zero when it becomes the active beat.
 */
function SteamChapterBeats({
  nudged,
  appid,
  name,
  eyebrow,
  releaseChip,
  tagline,
  recap,
  verdictClauses,
}: {
  nudged: boolean;
  appid: number;
  name: string;
  eyebrow: string;
  releaseChip: string | null;
  tagline: string;
  recap: SteamGameRecap | undefined;
  verdictClauses: ReturnType<typeof verdictParagraphSteam>;
}) {
  const beatCtx = useActiveBeat();
  const activeIndex = beatCtx?.active ?? 0;
  const beat0Active = nudged && activeIndex === 0;
  const beat1Active = nudged && activeIndex === 1;
  const beat2Active = nudged && activeIndex === 2;
  const beat3Active = nudged && activeIndex === 3;

  const standout = recap?.standoutUnlock ?? null;
  const recentUnlocks = recap?.recentUnlocks ?? [];
  const screenshots = recap?.screenshots ?? [];
  const completionPct = recap?.completionPct ?? null;
  const playtime2WeekMin = recap?.playtime2WeeksMinutes ?? null;
  const playtimeForeverMin = recap?.playtimeForeverMinutes ?? 0;
  const standoutGlobalPercent = standout?.globalPercent ?? null;

  return (
    <>
      <ChapterBeat index={0}>
        <ChapterOpener>
          <ChapterReveal active={beat0Active} delay={0.05} blur={4}>
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
                  <span
                    className="text-foreground/75"
                    style={{ textShadow: SHADOW_LABEL }}
                  >
                    {releaseChip}
                  </span>
                </>
              ) : null}
            </p>
          </ChapterReveal>
          <ChapterReveal
            active={beat0Active}
            delay={0.18}
            duration={1.1}
            blur={16}
            rise={20}
          >
            {/* Masthead-as-link: the chapter title IS the entry point to
                the game-detail page, magazine-style. Replaces the prior
                bottom-band CTA — frees vertical space (caret no longer
                collides with a closer button) and reads more editorial.
                Group-hover "→" mirrors the standout block's affordance. */}
            <Link
              to="/steam/game/$appid"
              params={{ appid: String(appid) }}
              className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-end gap-x-4 gap-y-2 rounded-md transition-opacity hover:opacity-95"
            >
              {recap?.hasLogo ? (
                // Official Steam logo as the masthead — typically a
                // designed wordmark / brand mark that reads more
                // "editorial" than typographic name in helvetica-7xl.
                // `alt={name}` carries the accessible label. Heavy
                // drop-shadow filter mirrors the SHADOW_MASTHEAD tier so
                // the logo still cuts cleanly against bright splash
                // chroma — text-shadow doesn't apply to img, so we use
                // filter: drop-shadow.
                <img
                  src={steamLibraryLogoUrl(appid, recap.assetTimestamp)}
                  alt={name}
                  className="max-h-[14dvh] w-auto max-w-full object-contain sm:max-h-[18dvh]"
                  style={{
                    filter:
                      "drop-shadow(0 1px 0 rgba(0,0,0,0.9)) drop-shadow(0 0 6px rgba(0,0,0,0.85)) drop-shadow(0 2px 16px rgba(0,0,0,0.6))",
                  }}
                />
              ) : (
                // Typographic fallback — covers the ~5% of titles that
                // ship without a publisher logo.
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
          {verdictClauses.length > 0 ? (
            <ChapterReveal active={beat0Active} delay={0.55} blur={6} className="pt-2">
              <VerdictProse
                clauses={verdictClauses}
                style={{ textShadow: SHADOW_BODY }}
                emphasisStyle={{
                  paintOrder: "stroke",
                  WebkitTextStroke: STROKE_ACCENT,
                  textShadow: SHADOW_ACCENT,
                }}
                numbersActive={beat0Active}
                numbersDelay={1.25}
              />
            </ChapterReveal>
          ) : null}
        </ChapterOpener>
      </ChapterBeat>

      <ChapterBeat index={1}>
        <ChapterDetail>
          {standout ? (
            <ChapterReveal active={beat1Active} delay={0.05}>
              <StandoutUnlockBlock appid={appid} standout={standout} />
            </ChapterReveal>
          ) : null}

          {recentUnlocks.length > 0 ? (
            <div className="flex flex-col gap-2 pt-2">
              <ChapterReveal active={beat1Active} delay={0.2}>
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
                    <ChapterReveal active={beat1Active} delay={0.25 + i * 0.06}>
                      <RecentUnlockRow appid={appid} unlock={u} />
                    </ChapterReveal>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </ChapterDetail>
      </ChapterBeat>

      <ChapterBeat index={2}>
        <ChapterStats>
          <PeakChip
            active={beat2Active}
            delay={0.05}
            label="Completion"
            value={completionPct !== null ? `${Math.round(completionPct * 100)}%` : "—"}
          />
          <PeakChip
            active={beat2Active}
            delay={0.12}
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
            active={beat2Active}
            delay={0.19}
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
      </ChapterBeat>

      <ChapterBeat index={3}>
        <ChapterCloser>
          <SteamChapterCloserMedia
            appid={appid}
            screenshots={screenshots}
            active={beat3Active}
          />
        </ChapterCloser>
      </ChapterBeat>
    </>
  );
}
