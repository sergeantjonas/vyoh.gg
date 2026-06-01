import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { AHRI_SKIN_ROTATION } from "@/home/landing-config";
import { mainScrollRef } from "@/lib/scroll-container";
import { championBackdropSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import { useDDragonVersion } from "@/lol/_shared/patch/use-ddragon-version";
import { useChampionRecap } from "@/lol/champions/use-champion-recap";
import { useChampionName } from "@/lol/champions/use-champions";
import { Link } from "@tanstack/react-router";
import {
  type ChampionRecap,
  type LolAccount,
  formatKda,
  verdictParagraph,
} from "@vyoh/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChapterCloser,
  ChapterDetail,
  ChapterOpener,
  ChapterStats,
} from "./chapter-bands";
import { ChapterContainer } from "./chapter-container";
import { ChapterReveal } from "./chapter-reveal";
import { useAssetClaim } from "./use-asset-claim";
import { useSkinRotation } from "./use-skin-rotation";
import { VerdictProse } from "./verdict-prose";

const CHAMPION_ALIAS = "Ahri";

// Hardcoded for the first per-champion chapter — the static bundle's
// LolChampionDto doesn't carry the editorial title field yet. When R-3+
// adds more per-subject chapters, promote this to the static pipeline
// (DDragon ships `title` per champion) and pass it through props.
const CHAMPION_TITLE = "the Nine-Tailed Fox";

// Text-shadow strengths tuned against the Ahri splash family. Bright
// splash crops (Spirit Blossom, Star Guardian) wash light text out where
// it sits over rim-light highlights; a layered dark halo binds the glyph
// edges without needing a card backdrop behind every text block.
const SHADOW_MASTHEAD = "0 2px 12px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.45)";
const SHADOW_BODY = "0 1px 4px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.4)";
const SHADOW_LABEL = "0 1px 3px rgba(0,0,0,0.6)";

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
 * Empty-recap shape — the deriver's zero-state, hand-authored so the verdict
 * paragraph generator still has a valid `ChampionRecap` to walk while data
 * is in-flight. Keeps the empty paragraph render path consistent: "No
 * tracked {alias} games yet." instead of an unmount-flash.
 */
function emptyRecapFor(alias: string, _displayName: string): ChampionRecap {
  return {
    alias,
    totalGames: 0,
    wins: 0,
    losses: 0,
    winRate: null,
    avgKda: null,
    signatureGame: null,
    recentMatches: [],
    peaks: {
      highestKills: 0,
      highestDamageShare: 0,
      perfectKdaCount: 0,
      avgKills: 0,
      aboveFiveKillsRate: 0,
      firstBloodRate: 0,
      avgGoldDiffAt15: 0,
    },
    streak: null,
    daysSinceLastGame: null,
    hourMode: null,
  };
}

/**
 * Signature-game receipt card — the "one game that proves the verdict",
 * picked by the deriver as the highest-kills + tiebreaker performance.
 * Clickable into the full match detail. Layout: K/D/A as the primary read,
 * outcome + duration + opponent + recency as supporting metadata.
 */
function SignatureGameCard({
  accountSlug,
  signature,
}: {
  accountSlug: string;
  signature: NonNullable<ChampionRecap["signatureGame"]>;
}) {
  const minutes = Math.max(1, Math.round(signature.durationSec / 60));
  return (
    <Link
      to="/lol/$accountSlug/matches/$matchId"
      params={{ accountSlug, matchId: signature.matchId }}
      // Card chrome refined for splash-readability: hairline border + soft
      // top-down gradient instead of a flat 55% backdrop. The previous flat
      // tint + `backdrop-blur-sm` was hitting splash chroma it didn't expect
      // and read as a smudge over bright/cool art crops.
      className="group flex cursor-pointer flex-col gap-1 rounded-xl border border-white/15 bg-gradient-to-b from-black/65 to-black/35 px-4 py-3 shadow-lg shadow-black/20 transition-colors hover:from-black/75 hover:to-black/50"
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">
        Signature game
      </span>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
          {signature.kills} / {signature.deaths} / {signature.assists}
        </span>
        {signature.opponentChampion ? (
          <span className="text-sm text-foreground/75">
            vs{" "}
            <span className="font-medium italic text-foreground/95">
              {signature.opponentChampion}
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/55">
        <span
          className={[
            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            signature.win
              ? "bg-emerald-400/20 text-emerald-300"
              : "bg-rose-400/20 text-rose-300",
          ].join(" ")}
        >
          {signature.win ? "Win" : "Loss"}
        </span>
        <span className="tabular-nums">{minutes}m</span>
        <span>·</span>
        <span>{signature.daysAgo === 0 ? "today" : `${signature.daysAgo}d ago`}</span>
        <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
          open →
        </span>
      </div>
    </Link>
  );
}

/**
 * Inline peak chip in the stats band — one supporting fact per chip. Kept
 * compact (no card chrome) because the verdict prose is doing the heavy
 * lifting above and these are just the receipts that back the claim.
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
  return (
    <ChapterReveal active={active} delay={delay}>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
          style={{ textShadow: SHADOW_BODY }}
        >
          {value}
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
 * First end-to-end recap chapter (R-2). Renders the Ahri subject as an
 * editorial chapter inside a single sticky-pin window: subject-led
 * eyebrow + masthead + verdict paragraph at the top, signature-game
 * receipt + recent runs strip in the middle, peak chips backing the
 * verdict, and a deep-stats CTA. The splash is the canvas; band content
 * floats with a thin scrim only where copy actually sits.
 *
 * The chapter publishes its splash via `useAssetClaim` so the shared
 * atmosphere layer paints it full-bleed; skin rotation cycles via
 * `useSkinRotation` independently of scroll.
 */
export function AhriChapter({ account }: { account: LolAccount }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const championName = useChampionName();
  const patch = useDDragonVersion();
  // Server-derived recap over the trailing 365 days of stored Ahri matches.
  // The hook returns a small typed aggregate (totals, peaks, signature game,
  // recent strip) so the chapter no longer has to flatten + filter pages of
  // mixed-champion match summaries on every render.
  const recapQuery = useChampionRecap(account, CHAMPION_ALIAS);
  const recap = recapQuery.data;

  // Auto-cycling rotation — timer-driven, not scroll-coupled. The earlier
  // progress-driven version mapped fast scrolls to rapid skin swaps, which
  // read as chaotic instead of ambient. Auto-cycle keeps the background
  // passive while scroll position drives only the reveal animations.
  const rotation = useSkinRotation(AHRI_SKIN_ROTATION.length);
  const activeSkin = AHRI_SKIN_ROTATION[rotation.activeIndex] ??
    AHRI_SKIN_ROTATION[0] ?? { name: "Base" };
  // `imageUrl` override wins when set; falls back to the proxy-served base
  // splash. Once the image proxy gains skin-index support, this composes
  // through it instead of a free-form override URL.
  const splashUrl =
    activeSkin.imageUrl ?? championBackdropSplashUrl(CHAMPION_ALIAS, patch);

  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);

  // Splash prefetch. The base splash starts fetching on mount so it's ready
  // by the time the chapter scrolls into view (no ambient-hero pop-through).
  // Other rotation skins prefetch after a short delay so they don't compete
  // with critical-path resources during initial page load — they only need
  // to be in cache by the time the auto-cycle ticks to them (~5s in).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const baseUrl =
      AHRI_SKIN_ROTATION[0]?.imageUrl ?? championBackdropSplashUrl(CHAMPION_ALIAS, patch);
    const baseImg = new Image();
    baseImg.src = baseUrl;
    const others = AHRI_SKIN_ROTATION.slice(1)
      .map((s) => s.imageUrl)
      .filter((u): u is string => Boolean(u));
    const timer = window.setTimeout(() => {
      for (const url of others) {
        const img = new Image();
        img.src = url;
      }
    }, 800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [patch]);
  // Per-chapter `--accent` cascade: the chapter's dominant champion-asset hex
  // drives `--accent` while the chapter is in view. Layer publishes it from
  // the dominant claim — falls back to the static neutral token outside any
  // subject chapter. championTheme is the same colour pipeline /lol routes
  // already use for `--theme-color`.
  const accentHex = championTheme(CHAMPION_ALIAS).dominantHex;
  const claim = useMemo(
    () => ({
      image: splashUrl,
      palette,
      bloomBlurPx: rotation.bloomBlurPx,
      accentHex,
    }),
    [splashUrl, palette, rotation.bloomBlurPx, accentHex]
  );
  useAssetClaim(outerRef, claim);

  // Polite one-shot nudge into the chapter pin. Triggers when the chapter
  // outer is 8% visible — i.e. roughly when the opener band's top edge
  // first enters the viewport from below. Smooth-scrolls main so the
  // chapter top aligns with viewport top (pin start), then flips `nudged`
  // ~500ms later (smooth-scroll settle window) to release the gated band
  // reveals. Lands the user in a stable view first, then plays the reveal
  // cascade from there — no animation runs during the approach scroll.
  //
  // One-shot: scrolling back up doesn't re-yank. Smooth-scroll respects
  // active user input mid-nudge (their scroll wins).
  const [nudged, setNudged] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setNudged(true);
      return;
    }
    const el = outerRef.current;
    if (!el) return;
    const main = mainScrollRef.current;
    let triggered = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.08 && !triggered) {
            triggered = true;
            if (main) {
              const target =
                main.scrollTop +
                el.getBoundingClientRect().top -
                main.getBoundingClientRect().top;
              main.scrollTo({ top: target, behavior: "smooth" });
            } else {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            settleTimer = setTimeout(() => setNudged(true), 500);
            observer.disconnect();
            break;
          }
        }
      },
      {
        root: main ?? null,
        threshold: 0.08,
      }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  // Recap may be `undefined` while loading or on error. Default to a
  // zero-state shape so the chapter still renders its layout (em-dash
  // peaks, empty recent strip) instead of unmounting.
  const totalGames = recap?.totalGames ?? 0;
  const winRate = recap?.winRate ?? 0;
  const avgKda = recap?.avgKda ?? 0;
  const recent = recap?.recentMatches ?? [];
  const signature = recap?.signatureGame ?? null;
  const perfectKdaCount = recap?.peaks.perfectKdaCount ?? 0;
  const displayName = championName(CHAMPION_ALIAS);
  // Subject-led voice. Avoids second-person "Your Ahri" — the page narrates
  // the owner *to* visitors, not to the owner herself. "VYOH'S AHRI" works
  // for both readings: the owner sees themselves, a visitor sees a portrait.
  const eyebrow = `${account.gameName}'s ${displayName}`;
  const skinLabel = activeSkin.name === "Base" ? null : activeSkin.name;

  // Verdict prose: structured segments from the shared deriver. The JSX
  // primitive `VerdictProse` renders each kind (text / number / subject /
  // opponent / emphasis) with its own typographic treatment. R-2g will
  // graft per-kind micromotion (count-up on numbers, character stagger on
  // subject/opponent) — for now the static hierarchy carries the prose.
  const verdictClauses = useMemo(
    () =>
      recap
        ? verdictParagraph(recap)
        : verdictParagraph(emptyRecapFor(CHAMPION_ALIAS, displayName)),
    [recap, displayName]
  );

  return (
    <div ref={outerRef} data-recap-chapter="ahri">
      <ChapterContainer
        pinViewports={2}
        slug="ahri"
        ariaLabel={eyebrow}
        pinClassName="items-start justify-start px-6 pt-[10dvh] sm:px-10"
      >
        {/* Skin badge: ambient corner label. Stays in the top-right of the
            pinned viewport, doesn't compete with the title block. */}
        {skinLabel ? (
          <ChapterReveal
            active={nudged}
            delay={0.6}
            className="pointer-events-none absolute right-6 top-[8dvh] z-10 sm:right-10"
          >
            <span className="rounded-full border border-border/40 bg-background/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-foreground/75 backdrop-blur-sm">
              {skinLabel}
            </span>
          </ChapterReveal>
        ) : null}

        {/* Chapter content fills the root container width (max-w-4xl from
            __root.tsx). Only the verdict prose itself ties off at editorial
            measure (~65ch via `max-w-prose` inside VerdictProse) so the
            paragraph stays readable while signature card / runs strip /
            stats stretch to the full container. */}
        <div className="flex w-full flex-col">
          <ChapterOpener>
            <ChapterReveal active={nudged} delay={0.05} blur={4}>
              <p
                className="text-xs uppercase tracking-[0.2em]"
                style={{
                  color: "var(--accent, currentColor)",
                  textShadow: SHADOW_LABEL,
                }}
              >
                {eyebrow}
              </p>
            </ChapterReveal>
            {/* Masthead + title subtext animate together as the hero tier —
                blur-up entrance matching the landing's editorial reveal so
                the chapter doesn't read as just another fade-in section. */}
            <ChapterReveal active={nudged} delay={0.18} blur={10}>
              <h2
                className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                style={{ textShadow: SHADOW_MASTHEAD }}
              >
                {displayName}
              </h2>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.3} blur={6}>
              <p
                className="text-sm italic text-foreground/80 sm:text-base"
                style={{ textShadow: SHADOW_LABEL }}
              >
                {CHAMPION_TITLE}
              </p>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.45} blur={6} className="pt-2">
              <VerdictProse
                clauses={verdictClauses}
                style={{ textShadow: SHADOW_BODY }}
              />
            </ChapterReveal>
          </ChapterOpener>

          <ChapterDetail>
            {signature ? (
              <ChapterReveal active={nudged} delay={0.7}>
                <SignatureGameCard accountSlug={account.slug} signature={signature} />
              </ChapterReveal>
            ) : null}

            {recent.length > 0 ? (
              <div className="flex flex-col gap-2 pt-2">
                <ChapterReveal active={nudged} delay={0.85}>
                  <h3
                    className="text-[10px] uppercase tracking-[0.2em] text-foreground/65"
                    style={{ textShadow: SHADOW_LABEL }}
                  >
                    Recent runs
                  </h3>
                </ChapterReveal>
                <ul className="flex flex-col gap-0.5">
                  {recent.map((m, i) => {
                    const delay = 0.9 + i * 0.06;
                    return (
                      <li key={m.matchId}>
                        <ChapterReveal active={nudged} delay={delay}>
                          <Link
                            to="/lol/$accountSlug/matches/$matchId"
                            params={{
                              accountSlug: account.slug,
                              matchId: m.matchId,
                            }}
                            // Hover affordance: a faint full-row band so the
                            // user can tell which row their pointer is on
                            // (the previous color-only hover wasn't visible
                            // against the splash). `-mx-2 px-2` lets the
                            // band extend past the row's natural padding.
                            className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-foreground/90 transition-colors hover:bg-white/8 hover:text-foreground"
                            style={{ textShadow: SHADOW_BODY }}
                          >
                            <span
                              aria-hidden="true"
                              className={[
                                "inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold",
                                m.win
                                  ? "bg-emerald-400/25 text-emerald-200"
                                  : "bg-rose-400/25 text-rose-200",
                              ].join(" ")}
                            >
                              {m.win ? "W" : "L"}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-foreground">
                              {m.kills}/{m.deaths}/{m.assists}
                            </span>
                            <span className="ml-auto text-xs text-foreground/70 group-hover:text-foreground/90">
                              {formatRelative(m.playedAt)}
                            </span>
                          </Link>
                        </ChapterReveal>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </ChapterDetail>

          <ChapterStats>
            <PeakChip
              active={nudged}
              delay={1.25}
              label="Win rate"
              value={totalGames > 0 ? `${Math.round(winRate * 100)}%` : "—"}
            />
            <PeakChip
              active={nudged}
              delay={1.32}
              label="Avg KDA"
              value={totalGames > 0 ? formatKda(avgKda) : "—"}
            />
            <PeakChip
              active={nudged}
              delay={1.39}
              label="Perfect KDA"
              value={
                totalGames > 0
                  ? `${perfectKdaCount} ${perfectKdaCount === 1 ? "game" : "games"}`
                  : "—"
              }
            />
          </ChapterStats>

          <ChapterCloser>
            <ChapterReveal active={nudged} delay={1.55}>
              <Link
                to="/lol/$accountSlug/champions/$championKey"
                params={{
                  accountSlug: account.slug,
                  championKey: CHAMPION_ALIAS.toLowerCase(),
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-black/55 px-4 py-2 text-sm font-medium text-foreground shadow-lg shadow-black/20 transition-colors hover:bg-black/70"
                style={{ textShadow: SHADOW_LABEL }}
              >
                View {displayName} deep stats →
              </Link>
            </ChapterReveal>
          </ChapterCloser>
        </div>
      </ChapterContainer>
    </div>
  );
}
