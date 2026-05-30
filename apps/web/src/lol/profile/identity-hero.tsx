import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { cn } from "@/lib/utils";
import { championHeroSplashUrl, rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import { useChampionName } from "@/lol/champions/use-champions";
import { type RankEntry, formatTimeAgo } from "@vyoh/shared";
import {
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { type PointerEvent, useState } from "react";
import { IDENTITY_AVATAR_MORPH_ID, IDENTITY_NAME_MORPH_ID } from "./identity-layout";
import { TIER_COLOR, TIER_GLOW } from "./profile-rank-tile";

const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

// Primary-queue entry for the headline crest (Solo preferred over Flex). Both
// queues still get their own tile below the hero.
function primaryEntry(entries: RankEntry[]): RankEntry | null {
  return (
    entries.find((e) => e.queueId === "RANKED_SOLO_5x5") ??
    entries.find((e) => e.queueId === "RANKED_FLEX_SR") ??
    null
  );
}

// Tier + division only (no LP) — the LP renders on its own line in the hero
// rank moment. Apex tiers (Master+) have no division.
function tierLabel(entry: RankEntry): string {
  const tier = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase();
  const division = APEX_TIERS.has(entry.tier) ? "" : ` ${entry.rank}`;
  return `${tier}${division}`;
}

interface LolIdentityHeroProps {
  gameName: string | undefined;
  tagLine: string | undefined;
  profileIconId: number | null | undefined;
  summonerLevel: number | null | undefined;
  rankEntries: RankEntry[];
  // Signature (top-played) champion alias — the SAME subject the page's
  // ambient backdrop uses, so the hero reads as that backdrop coming into
  // focus rather than a second, competing splash.
  splashChampion: string | null;
  // Most-recent non-remake match, for the "last played X · Nh ago" line.
  lastMatch?: { champion: string; playedAt: string } | null | undefined;
}

// Cinematic identity hero for the Profile landing: the signature champion's
// splash resolves into a sharp, framed banner (rank-tinted avatar + name +
// crest) at the top of the page, dissolving into the ambient wash below. The
// splash carries a slow Ken-Burns drift (CSS) plus a subtle pointer parallax
// (Motion); both collapse to a static frame under reduced motion.
export function LolIdentityHero({
  gameName,
  tagLine,
  profileIconId,
  summonerLevel,
  rankEntries,
  splashChampion,
  lastMatch,
}: LolIdentityHeroProps) {
  const ddVersion = useDDragonVersion();
  const championName = useChampionName();
  const emblemYear = useRankedEmblemYear();
  const reduced = useReducedMotion();
  // The hero owns the shared identity `layoutId` only while it's the on-screen
  // identity — i.e. at scroll-top. Once `compact` flips, the strip takes over
  // and morphs the avatar+name up into the header band; the hero (still mounted
  // above the fold) drops the id so the two never fight over it. Reduced motion
  // skips the shared layout entirely → instant swap. See identity-layout.ts.
  const { compact } = useSectionShellState();
  const morph = !compact && !reduced;
  const avatarLayoutId = morph ? IDENTITY_AVATAR_MORPH_ID : undefined;
  const nameLayoutId = morph ? IDENTITY_NAME_MORPH_ID : undefined;
  // Mark the avatar + name as the on-screen identity for the cross-nav VT morph
  // (identity-morph-nav.ts) — but only while the hero is the visible owner, i.e.
  // not compact. When compact the hero is opacity-0 and the strip carries the
  // markers instead, so exactly one avatar/name pair is tagged in the DOM at any
  // time and the morph driver can name an unambiguous source/destination.
  const markIdentity = !compact;

  // Supporting hero chrome (avatar glow, level badge, rank line, last-played)
  // fades in just as the avatar + name finish landing, so the hero assembles as
  // one move instead of the chrome popping into place while the identity is
  // still in flight. Driven off `compact` (not mount) so it replays on every
  // reveal: the tab→Profile nav morph AND the scroll-up from the collapsed
  // strip both flip `compact` false and re-run the staggered fade-in. The
  // ~slide-length in delay lands the fade at the end of the morph; collapsing
  // (compact true) fades out promptly. Excludes the morphing avatar + name.
  // Reduced motion swaps instantly.
  const detailReveal = (restOpacity: number) => ({
    initial: reduced ? false : ({ opacity: 0 } as const),
    animate: { opacity: compact ? 0 : restOpacity },
    transition: reduced
      ? { duration: 0 }
      : { delay: compact ? 0 : 0.22, duration: 0.26, ease: "easeOut" as const },
  });

  // The level badge sits at the bottom edge of the avatar's *landing* spot, so
  // fading it in alongside the chrome reads as the avatar sliding in behind a
  // pre-placed badge. Land it clearly AFTER the avatar arrives (longer delay
  // than the slide) and pop it with a small scale so it reads as settling onto
  // the avatar, not floating ahead of it. Collapsing fades it out promptly.
  const badgeReveal = {
    initial: reduced ? false : ({ opacity: 0, scale: 0.6 } as const),
    animate: { opacity: compact ? 0 : 1, scale: compact ? 0.6 : 1 },
    transition: reduced
      ? { duration: 0 }
      : compact
        ? { duration: 0.12, ease: "easeOut" as const }
        : { delay: 0.42, type: "spring" as const, stiffness: 520, damping: 24 },
  };

  const entry = primaryEntry(rankEntries);
  const tier = entry?.tier;
  // Tier identity lives in the rank crest + rank text only. The avatar glow
  // follows the CHAMPION (dominantHex) so the hero unifies with the page's
  // champion accent (nav/tabs/--theme-*) and leaves tier's prominent moment
  // to the rank crest (and the future animated-crest work).
  const tierText = tier
    ? (TIER_COLOR[tier] ?? "text-foreground")
    : "text-muted-foreground";
  // Tier-tinted backlight for the hero rank emblem (null → neutral fallback).
  const tierGlow = tier ? TIER_GLOW[tier] : undefined;

  const splashUrl = splashChampion
    ? championHeroSplashUrl(splashChampion, ddVersion)
    : null;
  const dominantHex = splashChampion ? championTheme(splashChampion).dominantHex : null;
  const [splashLoaded, setSplashLoaded] = useState(false);

  // Pointer parallax: the splash drifts a few px opposite the cursor. Springs
  // smooth the raw pointer signal; the transform sits on a wrapper distinct
  // from the Ken-Burns element so the two transforms compose cleanly.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 18 });
  const sy = useSpring(py, { stiffness: 120, damping: 18 });
  const tx = useTransform(sx, [-1, 1], [12, -12]);
  const ty = useTransform(sy, [-1, 1], [10, -10]);

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    px.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    py.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const resetPointer = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <section
      onPointerMove={onPointerMove}
      onPointerLeave={resetPointer}
      className="relative isolate overflow-hidden rounded-2xl border border-border/40"
    >
      {splashUrl && (
        <div aria-hidden className="-z-10 absolute inset-0">
          {/* Under reduced motion the pointer handler no-ops, so the springs
              stay parked at 0 and this transform is a static identity. */}
          <m.div className="absolute inset-0" style={{ x: tx, y: ty }}>
            <div className="lol-hero-drift absolute -inset-[7%]">
              <img
                src={splashUrl}
                alt=""
                loading="eager"
                decoding="async"
                onLoad={() => setSplashLoaded(true)}
                className={cn(
                  "size-full object-cover object-[72%_22%] transition-opacity duration-700",
                  splashLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          </m.div>
          {/* Champion-palette wash + legibility scrim. The left-to-right fade
              darkens the text column; the bottom fade dissolves the hero into
              the page background, reinforcing the focus-then-recede read. */}
          {dominantHex && (
            <div
              className="absolute inset-0 opacity-40 mix-blend-soft-light"
              style={{
                background: `linear-gradient(120deg, ${dominantHex} 0%, transparent 60%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-background from-5% via-background/55 via-45% to-transparent to-80%" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/15 to-transparent" />
        </div>
      )}

      <div className="relative flex min-h-[180px] items-end gap-4 p-6 sm:min-h-[220px]">
        {/* When `compact`, the strip's copy owns the visible identity and morphs
            up via the shared `layoutId`; the hero's avatar+name (still scrolled
            partly in view) go invisible so there's no ghost duplicate. Opacity
            only — Motion still measures the hidden box as the morph source. */}
        <div className={cn("relative isolate shrink-0", compact && "opacity-0")}>
          {/* Champion-tinted glow bloom behind the avatar (matches the page
              accent). Neutral rim ring keeps a crisp edge over the splash. */}
          <m.span
            {...detailReveal(0.6)}
            {...(dominantHex ? { style: { backgroundColor: dominantHex } } : {})}
            aria-hidden
            className={cn(
              "-z-10 absolute -inset-2 rounded-full opacity-60 blur-2xl",
              !dominantHex && "bg-foreground/10"
            )}
          />
          {profileIconId != null ? (
            <m.img
              {...(avatarLayoutId ? { layoutId: avatarLayoutId } : {})}
              {...(markIdentity ? { "data-identity-avatar": "" } : {})}
              src={profileIconUrl(profileIconId, ddVersion)}
              alt=""
              className="size-20 rounded-full object-cover ring-2 ring-white/15 sm:size-24"
            />
          ) : (
            <div className="size-20 animate-pulse rounded-full bg-muted ring-2 ring-white/15 sm:size-24" />
          )}
          {summonerLevel != null && (
            <m.span
              {...badgeReveal}
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-background px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ring-1 ring-border"
            >
              {summonerLevel}
            </m.span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          {gameName ? (
            <m.h2
              {...(nameLayoutId ? { layoutId: nameLayoutId } : {})}
              {...(markIdentity ? { "data-identity-name": "" } : {})}
              className={cn(
                "truncate font-semibold text-3xl tracking-tight drop-shadow-sm sm:text-4xl",
                compact && "opacity-0"
              )}
            >
              {gameName}
              <span className="text-muted-foreground">#{tagLine}</span>
            </m.h2>
          ) : (
            <div className="h-9 w-56 animate-pulse rounded bg-muted" />
          )}
          {entry ? (
            <m.div {...detailReveal(1)} className="mt-0.5 flex items-center gap-2.5">
              {/* Cinematic rank moment: the emblem sits in a tier-tinted glow
                  bloom (mirrors the avatar's champion glow), so rank reads as
                  part of the hero treatment rather than text floating on the
                  splash. The hero owns rank-as-identity; the tiles below own
                  rank-as-performance (W/L, win%, LP trend). */}
              <div className="relative shrink-0">
                <span
                  aria-hidden
                  className={cn(
                    "-z-10 absolute -inset-1.5 rounded-full opacity-50 blur-xl",
                    tierGlow ?? "bg-foreground/10"
                  )}
                />
                <img
                  src={rankEmblemUrl(entry.tier, emblemYear)}
                  alt=""
                  className="size-11 object-contain drop-shadow-md sm:size-12"
                />
              </div>
              <span className="flex flex-col leading-tight">
                <span className={cn("font-semibold text-lg tracking-tight", tierText)}>
                  {tierLabel(entry)}
                </span>
                <span className="font-medium text-muted-foreground text-xs tabular-nums">
                  {entry.leaguePoints} LP
                </span>
              </span>
            </m.div>
          ) : (
            <m.span
              {...detailReveal(1)}
              className="mt-1 font-medium text-muted-foreground text-sm"
            >
              Unranked
            </m.span>
          )}
          {lastMatch && (
            <m.p {...detailReveal(1)} className="text-muted-foreground text-xs">
              Last played {championName(lastMatch.champion)} ·{" "}
              {formatTimeAgo(lastMatch.playedAt)}
            </m.p>
          )}
        </div>
      </div>
    </section>
  );
}
