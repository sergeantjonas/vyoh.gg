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
      className="group flex cursor-pointer flex-col gap-1 rounded-xl border border-border/40 bg-background/55 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-background/70"
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
        <span className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
          {value}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">
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

        <div className="flex w-full max-w-2xl flex-col">
          <ChapterOpener>
            <ChapterReveal active={nudged} delay={0.05}>
              <p
                className="text-xs uppercase tracking-[0.2em]"
                style={{ color: "var(--accent, currentColor)" }}
              >
                {eyebrow}
              </p>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.18}>
              <h2 className="text-6xl font-semibold leading-none text-foreground sm:text-7xl">
                {displayName}
              </h2>
            </ChapterReveal>
            <ChapterReveal active={nudged} delay={0.4} className="pt-2">
              <VerdictProse clauses={verdictClauses} />
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
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">
                    Recent runs
                  </h3>
                </ChapterReveal>
                <ul className="flex flex-col gap-1">
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
                            className="group flex items-center gap-3 rounded-md py-1 text-sm text-foreground/85 transition-colors hover:text-foreground"
                          >
                            <span
                              aria-hidden="true"
                              className={[
                                "inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold",
                                m.win
                                  ? "bg-emerald-400/20 text-emerald-300"
                                  : "bg-rose-400/20 text-rose-300",
                              ].join(" ")}
                            >
                              {m.win ? "W" : "L"}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-foreground/95">
                              {m.kills}/{m.deaths}/{m.assists}
                            </span>
                            <span className="ml-auto text-xs text-foreground/55 group-hover:text-foreground/75">
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
                className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-foreground hover:bg-card/60"
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
