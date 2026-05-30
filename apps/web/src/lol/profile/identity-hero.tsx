import { useSectionShellState } from "@/_shared/section-layout/section-shell-context";
import { cn } from "@/lib/utils";
import { championHeroSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { profileIconUrl } from "@/lol/_shared/assets/summoner-icon";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
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
import { HeroRankStrip } from "./hero-rank-strip";
import { IDENTITY_AVATAR_MORPH_ID, IDENTITY_NAME_MORPH_ID } from "./identity-layout";

interface LolIdentityHeroProps {
  gameName: string | undefined;
  tagLine: string | undefined;
  profileIconId: number | null | undefined;
  summonerLevel: number | null | undefined;
  rankEntries: RankEntry[];
  // Per-queue normalized-LP series (last ~30d, oldest first) for the rank
  // strip's LP sparklines. Optional — the strip renders without trend lines
  // until the rank-history query settles.
  recentLpByQueue?: Record<string, number[]> | undefined;
  // Signature (top-played) champion alias — the SAME subject the page's
  // ambient backdrop uses, so the hero reads as that backdrop coming into
  // focus rather than a second, competing splash.
  splashChampion: string | null;
  // Most-recent non-remake match, for the "last played X · Nh ago" line.
  lastMatch?: { champion: string; playedAt: string } | null | undefined;
}

// Cinematic identity hero for the Profile landing: the signature champion's
// splash resolves into a sharp, framed banner filling the card, with identity
// (avatar + name + last-played) top-left and both ranked queues fused into a
// frosted-glass performance strip across the bottom — one unified rank surface,
// no separate tiles below. The splash carries a slow Ken-Burns drift (CSS) plus
// a subtle pointer parallax (Motion); both collapse to a static frame under
// reduced motion.
export function LolIdentityHero({
  gameName,
  tagLine,
  profileIconId,
  summonerLevel,
  rankEntries,
  recentLpByQueue,
  splashChampion,
  lastMatch,
}: LolIdentityHeroProps) {
  const ddVersion = useDDragonVersion();
  const championName = useChampionName();
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
          {lastMatch && (
            <m.p {...detailReveal(1)} className="text-muted-foreground text-sm">
              Last played {championName(lastMatch.champion)} ·{" "}
              {formatTimeAgo(lastMatch.playedAt)}
            </m.p>
          )}
        </div>
      </div>

      {/* Both ranked queues fused into a frosted-glass performance band across
          the card bottom — the single rank surface for the profile (no tiles
          below). Sits above the absolute splash layer; hidden in lockstep with
          the identity when the hero collapses to the compact strip. */}
      <HeroRankStrip
        entries={rankEntries}
        recentLpByQueue={recentLpByQueue}
        compact={compact}
      />
    </section>
  );
}
