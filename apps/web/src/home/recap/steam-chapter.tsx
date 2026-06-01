import { Link } from "@tanstack/react-router";
import type { SteamGameRecap, SteamStandoutUnlock, SteamUnlock } from "@vyoh/shared";
import { formatPlaytime, verdictParagraphSteam } from "@vyoh/shared";
import { useEffect, useMemo, useRef } from "react";

import { CountUp } from "@/components/count-up";
import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { STEAM_FEATURED_APPID } from "@/home/landing-config";
import {
  steamAchievementIconUrl,
  steamLibraryHeroLargeUrl,
  steamPageBackgroundUrl,
} from "@/steam/_shared/steam-image";
import { useSteamGameRecap } from "@/steam/use-steam-game-recap";

import {
  ChapterCloser,
  ChapterDetail,
  ChapterOpener,
  ChapterStats,
} from "./chapter-bands";
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
import { ScreenshotLightboxStrip } from "./screenshot-lightbox";
import { useAssetClaim } from "./use-asset-claim";
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
export function SteamChapter({ appid = STEAM_FEATURED_APPID }: { appid?: number } = {}) {
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
  const claim = useMemo(
    () => ({
      ...(splashUrl !== null ? { image: splashUrl } : {}),
      palette,
      ...(accentHex !== null ? { accentHex } : {}),
    }),
    [splashUrl, palette, accentHex]
  );
  useAssetClaim(outerRef, claim);

  // Prefetch the splash so the asset is in cache by the time the chapter
  // approaches the viewport — keeps the backdrop reveal a single paint
  // rather than a load-then-paint flash.
  useEffect(() => {
    if (typeof window === "undefined" || splashUrl === null) return;
    const img = new Image();
    img.src = splashUrl;
  }, [splashUrl]);

  // Polite one-shot nudge into the chapter pin — see `useChapterNudge` for
  // the threshold + settle tuning notes.
  const nudged = useChapterNudge(outerRef);

  // Defaults so the chapter layout always has *something* to render — the
  // empty-state copy line from verdictParagraphSteam handles the
  // never-played edge structurally without a separate unmount path.
  const name = recap?.name ?? "";
  const tagline = useMemo(() => firstSentence(recap?.shortDescription ?? null), [recap]);
  const eyebrow = recap?.ageBucket ? EYEBROW_FOR_BUCKET[recap.ageBucket] : "Steam";
  const standout = recap?.standoutUnlock ?? null;
  const recentUnlocks = recap?.recentUnlocks ?? [];
  const screenshots = (recap?.screenshots ?? []).slice(0, 4);
  const completionPct = recap?.completionPct ?? null;
  const playtime2WeekMin = recap?.playtime2WeeksMinutes ?? null;
  const playtimeForeverMin = recap?.playtimeForeverMinutes ?? 0;
  const standoutGlobalPercent = standout?.globalPercent ?? null;

  const verdictClauses = useMemo(
    () => (recap ? verdictParagraphSteam(recap) : []),
    [recap]
  );

  return (
    <div ref={outerRef} data-recap-chapter="steam" data-steam-appid={appid}>
      <ChapterContainer
        pinViewports={1}
        slug={`steam-${appid}`}
        ariaLabel={name || `Steam game ${appid}`}
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
              </p>
            </ChapterReveal>
            <ChapterReveal
              active={nudged}
              delay={0.18}
              duration={1.1}
              blur={16}
              rise={20}
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2
                  className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                  style={{ textShadow: SHADOW_MASTHEAD }}
                >
                  {name}
                </h2>
                {tagline ? (
                  <p
                    className="text-base italic text-foreground/80 sm:text-lg"
                    style={{ textShadow: SHADOW_LABEL }}
                  >
                    {tagline}
                  </p>
                ) : null}
              </div>
            </ChapterReveal>
            {verdictClauses.length > 0 ? (
              <ChapterReveal active={nudged} delay={0.55} blur={6} className="pt-2">
                <VerdictProse
                  clauses={verdictClauses}
                  style={{ textShadow: SHADOW_BODY }}
                  emphasisStyle={{
                    paintOrder: "stroke",
                    WebkitTextStroke: STROKE_ACCENT,
                    textShadow: SHADOW_ACCENT,
                  }}
                  numbersActive={nudged}
                  numbersDelay={1.25}
                />
              </ChapterReveal>
            ) : null}
          </ChapterOpener>

          <ChapterDetail>
            {standout ? (
              <ChapterReveal active={nudged} delay={0.7}>
                <StandoutUnlockBlock appid={appid} standout={standout} />
              </ChapterReveal>
            ) : null}

            {recentUnlocks.length > 0 ? (
              <div className="flex flex-col gap-2 pt-2">
                <ChapterReveal active={nudged} delay={0.85}>
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
                      <ChapterReveal active={nudged} delay={0.9 + i * 0.06}>
                        <RecentUnlockRow appid={appid} unlock={u} />
                      </ChapterReveal>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </ChapterDetail>

          <ChapterStats>
            <PeakChip
              active={nudged}
              delay={1.25}
              label="Completion"
              value={completionPct !== null ? `${Math.round(completionPct * 100)}%` : "—"}
            />
            <PeakChip
              active={nudged}
              delay={1.32}
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
              delay={1.39}
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

          <ChapterCloser>
            {screenshots.length > 0 ? (
              <ChapterReveal active={nudged} delay={1.5}>
                <ScreenshotLightboxStrip appid={appid} screenshots={screenshots} />
              </ChapterReveal>
            ) : null}
            <ChapterReveal active={nudged} delay={1.55}>
              <Link
                to="/steam/game/$appid"
                params={{ appid: String(appid) }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-black/55 px-4 py-2 text-sm font-medium text-foreground shadow-lg shadow-black/20 transition-colors hover:bg-black/70"
                style={{ textShadow: SHADOW_LABEL }}
              >
                View {name || "game"} →
              </Link>
            </ChapterReveal>
          </ChapterCloser>
        </div>
      </ChapterContainer>
    </div>
  );
}
