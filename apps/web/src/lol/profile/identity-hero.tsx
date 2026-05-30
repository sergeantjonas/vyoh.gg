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
import { TIER_COLOR } from "./profile-rank-tile";

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

function rankLabel(entry: RankEntry): string {
  const tier = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase();
  const division = APEX_TIERS.has(entry.tier) ? "" : ` ${entry.rank}`;
  return `${tier}${division} · ${entry.leaguePoints} LP`;
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

  const entry = primaryEntry(rankEntries);
  const tier = entry?.tier;
  // Tier identity lives in the rank crest + rank text only. The avatar glow
  // follows the CHAMPION (dominantHex) so the hero unifies with the page's
  // champion accent (nav/tabs/--theme-*) and leaves tier's prominent moment
  // to the rank crest (and the future animated-crest work).
  const tierText = tier
    ? (TIER_COLOR[tier] ?? "text-foreground")
    : "text-muted-foreground";

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
        <div className="relative isolate shrink-0">
          {/* Champion-tinted glow bloom behind the avatar (matches the page
              accent). Neutral rim ring keeps a crisp edge over the splash. */}
          <span
            aria-hidden
            className={cn(
              "-z-10 absolute -inset-2 rounded-full opacity-60 blur-2xl",
              !dominantHex && "bg-foreground/10"
            )}
            style={dominantHex ? { backgroundColor: dominantHex } : undefined}
          />
          {profileIconId != null ? (
            <img
              src={profileIconUrl(profileIconId, ddVersion)}
              alt=""
              className="size-20 rounded-full object-cover ring-2 ring-white/15 sm:size-24"
            />
          ) : (
            <div className="size-20 animate-pulse rounded-full bg-muted ring-2 ring-white/15 sm:size-24" />
          )}
          {summonerLevel != null && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-background px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums ring-1 ring-border">
              {summonerLevel}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          {gameName ? (
            <h2 className="truncate font-semibold text-3xl tracking-tight drop-shadow-sm sm:text-4xl">
              {gameName}
              <span className="text-muted-foreground">#{tagLine}</span>
            </h2>
          ) : (
            <div className="h-9 w-56 animate-pulse rounded bg-muted" />
          )}
          {entry ? (
            <div className="flex items-center gap-2">
              <img
                src={rankEmblemUrl(entry.tier, emblemYear)}
                alt=""
                className="size-7 object-contain drop-shadow"
              />
              <span className={cn("font-medium text-sm", tierText)}>
                {rankLabel(entry)}
              </span>
            </div>
          ) : (
            <span className="font-medium text-muted-foreground text-sm">Unranked</span>
          )}
          {lastMatch && (
            <p className="text-muted-foreground text-xs">
              Last played {championName(lastMatch.champion)} ·{" "}
              {formatTimeAgo(lastMatch.playedAt)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
