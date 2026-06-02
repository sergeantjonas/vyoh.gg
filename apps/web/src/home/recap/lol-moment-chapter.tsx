import { Link } from "@tanstack/react-router";
import type { LolAccount } from "@vyoh/shared";
import { useEffect, useMemo, useRef, useState } from "react";

import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { championBackdropSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
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
import { useAssetPreload } from "./use-asset-preload";
import { useChapterNudge } from "./use-chapter-nudge";

/** Anchor champion the chapter dissolves *away from* during the silhouette
 *  beat. Hardcoded to Ahri because R-6's framing — "the owner is an Ahri OTP;
 *  here's the off-meta moment" — is rooted in the same identity the Ahri
 *  anchor chapter establishes above. When R-7 generalises to other main
 *  champions (theoretically possible if the owner pivots), pull this from
 *  the same source `LolMomentsService.detectOffMetaPicks` uses for the main
 *  pool top-slot. */
const ANCHOR_CHAMPION_ALIAS = "Ahri";

/** Hold before the silhouette → reveal swap fires, in ms. Long enough that
 *  the chapter's opening cascade can finish first, short enough that the
 *  reveal still reads as the chapter's signature beat rather than an
 *  afterthought. Mirrors the 800ms initial-hold the Ahri skin-rotation uses
 *  before its first auto-cycle. */
const REVEAL_HOLD_MS = 800;

function formatDaysSince(daysSince: number): string {
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 14) return "last week";
  if (daysSince < 30) return `${Math.round(daysSince / 7)} weeks ago`;
  return `${Math.round(daysSince / 30)} months ago`;
}

interface Props {
  account: LolAccount;
  championAlias: string;
  matchId: string | null;
  daysSince: number;
  slug: string;
}

/**
 * First moment chapter (R-6). Renders the owner's most recent OFF_META_PICK
 * — a match where they played a champion outside their usual rotation. The
 * signature beat is a *silhouette dissolve*: the chapter opens with the
 * anchor champion's splash (Ahri, the OTP identity) as backdrop, holds
 * briefly after the user lands inside the chapter, then swaps to the
 * off-meta champion's splash. The atmosphere layer handles the visual
 * transition between the two image claims; this component just drives
 * the URL swap.
 *
 * Proof-of-pattern shape: one editorial beat, no stats panel, no detail
 * strip. R-7 expansion (RANK_UP, KDA_OUTLIER, STREAK, RETURN_FROM_HIATUS,
 * MARATHON) will compose its own per-momentType layouts — this chapter is
 * the structural template they share, not a primitive to extend in place.
 */
export function LolMomentChapter({
  account,
  championAlias,
  matchId,
  daysSince,
  slug,
}: Props) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const championName = useChampionName();
  const patch = useDDragonVersion();
  const nudged = useChapterNudge(outerRef);

  // Silhouette dissolve: start on the anchor champion's splash, swap to the
  // off-meta champion after the user has landed in the chapter and the
  // opening cascade has settled. The atmosphere layer crossfades between
  // image URLs naturally when the claim's `image` field changes.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (!nudged) return;
    const timer = window.setTimeout(() => setRevealed(true), REVEAL_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [nudged]);

  const anchorSplashUrl = useMemo(
    () => championBackdropSplashUrl(ANCHOR_CHAMPION_ALIAS, patch),
    [patch]
  );
  const offMetaSplashUrl = useMemo(
    () => championBackdropSplashUrl(championAlias, patch),
    [championAlias, patch]
  );
  const splashUrl = revealed ? offMetaSplashUrl : anchorSplashUrl;

  // Off-meta moments are lazy by default — they sit below the Ahri anchor
  // and at least one Steam subject in the typical chapter order. The
  // anchor splash is already preloaded as critical-path by AhriChapter; the
  // off-meta splash gates on viewport proximity so it doesn't compete
  // during initial page load.
  useAssetPreload(outerRef, [offMetaSplashUrl]);
  // If for any reason this chapter ends up first (unlikely, but possible
  // when LoL moments outrank every Steam subject), make sure the anchor
  // splash is also link-preloaded — the Ahri chapter component would
  // normally own that, but `routes/index.tsx` only mounts AhriChapter when
  // a primary account is present, and this moment chapter is gated on the
  // same prerequisite, so the duplicate `<link>` is harmless either way
  // (preloadLinkAsImage is idempotent).
  useEffect(() => preloadLinkAsImage(anchorSplashUrl), [anchorSplashUrl]);

  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);
  // Accent picks up the OFF-META champion's theme color, not the anchor's —
  // the moment is *about* the off-meta pick; the accent should match.
  const accentHex = championTheme(championAlias).dominantHex;
  const claim = useMemo(
    () => ({ image: splashUrl, palette, accentHex }),
    [splashUrl, palette, accentHex]
  );
  useAssetClaim(outerRef, claim);

  const displayName = championName(championAlias);
  const anchorDisplayName = championName(ANCHOR_CHAMPION_ALIAS);
  const eyebrow = "Off-meta pick";
  const whenLine = formatDaysSince(daysSince);

  return (
    <div
      ref={outerRef}
      data-recap-chapter={slug}
      data-chapter-label={`Off-meta · ${displayName}`}
      className="[scroll-snap-align:start] [scroll-snap-stop:always]"
    >
      <ChapterContainer
        pinViewports={1}
        slug={slug}
        ariaLabel={`${eyebrow}: ${displayName}`}
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
                  <h2
                    className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                    style={{ textShadow: SHADOW_MASTHEAD }}
                  >
                    {displayName}
                  </h2>
                  <span className="text-sm italic text-foreground/70 opacity-0 transition-opacity group-hover/masthead:opacity-100">
                    open →
                  </span>
                </Link>
              ) : (
                <h2
                  className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                  style={{ textShadow: SHADOW_MASTHEAD }}
                >
                  {displayName}
                </h2>
              )}
            </ChapterReveal>
          </ChapterOpener>
          <ChapterDetail>
            <ChapterReveal active={nudged} delay={0.55} blur={6}>
              <p
                className="max-w-prose text-base text-foreground/85 sm:text-lg"
                style={{ textShadow: SHADOW_BODY }}
              >
                Stepped off{" "}
                <span
                  className="font-medium italic text-foreground/95"
                  style={{
                    paintOrder: "stroke",
                    WebkitTextStroke: STROKE_ACCENT,
                    textShadow: SHADOW_ACCENT,
                  }}
                >
                  {anchorDisplayName}
                </span>{" "}
                for a one-off run on{" "}
                <span
                  className="font-medium italic text-foreground/95"
                  style={{
                    paintOrder: "stroke",
                    WebkitTextStroke: STROKE_ACCENT,
                    textShadow: SHADOW_ACCENT,
                  }}
                >
                  {displayName}
                </span>
                .
              </p>
            </ChapterReveal>
          </ChapterDetail>
        </div>
      </ChapterContainer>
    </div>
  );
}
