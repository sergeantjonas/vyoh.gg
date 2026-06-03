import { Link } from "@tanstack/react-router";
import type { SteamFirstTimeStats, SteamMomentChapterDescriptor } from "@vyoh/shared";
import { formatPlaytime } from "@vyoh/shared";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { steamLibraryHeroLargeUrl } from "@/steam/_shared/steam-image";

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

type MomentType = SteamMomentChapterDescriptor["momentType"];

interface MomentCopy {
  eyebrow: string;
  mastheadText: string;
  chapterLabel: string;
  ariaLabel: string;
  body: ReactNode;
}

/** Accent span shared across momentType prose — uppercase-italic, paint-
 *  order outline against the hero backdrop. Matches the LoL moment chapter's
 *  Accent so both moment kinds read as one editorial family. */
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

/**
 * Per-momentType editorial copy. FIRST_TIME_GAME ships in R-7f;
 * ACHIEVEMENT_CLUSTER lands in R-7g and replaces the placeholder branch
 * with cluster-specific prose. The function shape mirrors `momentCopy` in
 * `lol-moment-chapter.tsx` so both moment chapters stay legible side by
 * side.
 */
function momentCopy(args: {
  momentType: MomentType;
  name: string;
  firstTime: SteamFirstTimeStats | null;
}): MomentCopy {
  const { momentType, name, firstTime } = args;
  if (momentType === "FIRST_TIME_GAME") {
    const playLine = firstTime ? formatPlaytime(firstTime.windowPlayMinutes) : null;
    return {
      eyebrow: "First time on",
      mastheadText: name,
      chapterLabel: "First time",
      ariaLabel: `First time playing ${name}`,
      body: playLine ? (
        <>
          Just picked this one up — already <Accent>{playLine}</Accent> in.
        </>
      ) : (
        <>Just picked this one up.</>
      ),
    };
  }
  // ACHIEVEMENT_CLUSTER placeholder until R-7g lands the cluster detector
  // + cluster-shaped editorial. Keeps the discriminated union exhaustive
  // so a future moment type doesn't render an empty masthead.
  return {
    eyebrow: "Recent run on",
    mastheadText: name,
    chapterLabel: "Recent run",
    ariaLabel: `Recent run on ${name}`,
    body: (
      <>
        Stretch of achievements stacked up on <Accent>{name}</Accent>.
      </>
    ),
  };
}

function formatDaysSince(daysSince: number): string {
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 14) return "last week";
  if (daysSince < 30) return `${Math.round(daysSince / 7)} weeks ago`;
  return `${Math.round(daysSince / 30)} months ago`;
}

interface Props {
  appid: number;
  name: string;
  daysSince: number;
  slug: string;
  momentType: MomentType;
  firstTime: SteamFirstTimeStats | null;
}

/**
 * First Steam moment chapter (R-7f). Single-event narrative for a
 * FIRST_TIME_GAME — a game added to the library inside the recency window
 * with meaningful play minutes since. Visual: full-bleed library hero
 * (1640×924 transcoded by the proxy), routed through the atmosphere claim
 * so the page background carries the hero's palette while the chapter is
 * pinned. Falls back to the page-background scenic variant for the ~9% of
 * older titles without `library_hero.jpg`.
 *
 * Per-momentType editorial copy lives in `momentCopy()`; the ACHIEVEMENT_
 * CLUSTER branch is a placeholder until R-7g lands the cluster detector.
 *
 * The visual differentiation polish (R-7h) layers per-type leadingVisual,
 * stat-strip shape, and accent tint across both LoL and Steam moments so
 * the chapter family stops reading "samey".
 */
export function SteamMomentChapter({
  appid,
  name,
  daysSince,
  slug,
  momentType,
  firstTime,
}: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);

  // No `useSteamGameRecap` roundtrip — the descriptor already carries the
  // display name, and the hero URL is a deterministic appid-keyed proxy
  // path. Keeps the moment chapter independent of the heavier game-recap
  // query that powers `SteamChapter`. Newly-added games (the population
  // this chapter draws from) almost always have `library_hero.jpg`, so the
  // ~9% pre-2019 long-tail fallback isn't load-bearing here. R-7h polish
  // can add a page-background fallback chain if real owner data ever
  // surfaces a first-time row missing the asset.
  const heroUrl = useMemo(() => steamLibraryHeroLargeUrl(appid), [appid]);

  useEffect(() => preloadLinkAsImage(heroUrl), [heroUrl]);

  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  const claim = useMemo(() => ({ image: heroUrl, palette }), [heroUrl, palette]);
  useAssetClaim(outerRef, claim);

  const nudged = useChapterNudge(outerRef);
  const copy = momentCopy({ momentType, name, firstTime });
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
              <Link
                to="/steam/game/$appid"
                params={{ appid: String(appid) }}
                className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
              >
                <h2
                  className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                  style={{ textShadow: SHADOW_MASTHEAD }}
                >
                  {copy.mastheadText}
                </h2>
                <span className="text-sm italic text-foreground/70 opacity-0 transition-opacity group-hover/masthead:opacity-100">
                  open →
                </span>
              </Link>
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
          {firstTime ? (
            <ChapterDetail>
              <ChapterReveal active={nudged} delay={0.7}>
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                  {/* Single-stat receipt — the "this isn't a click-and-quit
                      launch" proof. R-7h will replace this with a per-type
                      stat strip (cluster size for ACHIEVEMENT_CLUSTER,
                      session-count breakdown for FIRST_TIME_GAME). */}
                  <span
                    className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
                    style={{ textShadow: SHADOW_MASTHEAD }}
                  >
                    {formatPlaytime(firstTime.windowPlayMinutes)}
                  </span>
                  <span
                    className="text-sm text-foreground/70"
                    style={{ textShadow: SHADOW_BODY }}
                  >
                    in the books
                  </span>
                </div>
              </ChapterReveal>
            </ChapterDetail>
          ) : null}
        </div>
      </ChapterContainer>
    </div>
  );
}
