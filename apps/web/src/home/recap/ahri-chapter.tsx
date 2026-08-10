import { CountUp } from "@/components/count-up";
import { currentBrusselsHour, paletteForHour } from "@/home/ambient-hero";
import { AHRI_SKIN_ROTATION } from "@/home/landing-config";
import { championBackdropSplashUrl } from "@/lol/_shared/assets/champion-icon";
import { championTheme } from "@/lol/_shared/assets/champion-theme";
import {
  RoleIcon,
  type RolePosition,
  isRolePosition,
} from "@/lol/_shared/assets/role-icon";
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
import { motion } from "motion/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { BeatAccentSlash } from "./beat-accent-slash";
import { ChapterDetail, ChapterOpener, ChapterStats } from "./chapter-bands";
import { ChapterMultiBeat } from "./chapter-multi-beat";
import { useChapterGroupNudge } from "./chapter-nudge-contexts";
import { ChapterReveal } from "./chapter-reveal";
import { ChapterShareButton } from "./chapter-share-button";
import { MultiBeat } from "./multi-beat";
import { parseAnimatableNumber } from "./parse-animatable-number";
import { preloadLinkAsImage } from "./preload-link";
import { useAssetClaim } from "./use-asset-claim";
import { useAssetPreload } from "./use-asset-preload";
import { useChapterNudge } from "./use-chapter-nudge";
import { useSkinRotation } from "./use-skin-rotation";
import { VerdictProse } from "./verdict-prose";

const CHAMPION_ALIAS = "Ahri";

// Hardcoded for the first per-champion chapter — the static bundle's
// LolChampionDto doesn't carry the editorial title field yet. When R-3+
// adds more per-subject chapters, promote this to the static pipeline
// (DDragon ships `title` per champion) and pass it through props.
const CHAMPION_TITLE = "the Nine-Tailed Fox";

// Shadow tier + accent stroke constants live in `chapter-shadows.ts` so
// the Steam chapter (R-3) inherits the same readability strategy without
// duplicating the tuning notes. The "why" lives in that module.
import {
  SHADOW_ACCENT,
  SHADOW_BODY,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
  STROKE_LABEL,
} from "./chapter-shadows";

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
 * Signature-game receipt — the "one game that proves the verdict", picked
 * by the deriver as the highest-kills + tiebreaker performance. Rendered
 * as an editorial beat, NOT a card: bare label + hero-large KDA + inline
 * opponent + meta strip. The whole block is a single click target into the
 * match detail; chrome would have made it read as a UI module dropped into
 * the magazine spread, which the bare-wrapper chapter philosophy avoids.
 */
function SignatureGameBlock({
  accountSlug,
  signature,
  championName,
}: {
  accountSlug: string;
  signature: NonNullable<ChampionRecap["signatureGame"]>;
  /** `useChampionName()` filter — Riot aliases (`AurelionSol`, `JarvanIV`,
   *  `MonkeyKing`) diverge from display names; render-site convention. */
  championName: (alias: string) => string;
}) {
  const minutes = Math.max(1, Math.round(signature.durationSec / 60));
  return (
    <Link
      to="/lol/$accountSlug/matches/$matchId"
      params={{ accountSlug, matchId: signature.matchId }}
      // Bare editorial block: no border, no backdrop. Negative inline-x
      // margin + matching padding gives a hover band that reads as "row is
      // active" without painting a permanent card edge against the splash.
      // Dark hover (`bg-black/25`) reads calmer than a white lift on
      // bright splash crops — matches the recent-runs row treatment below.
      className="group -mx-3 flex cursor-pointer flex-col gap-2 rounded-md px-3 py-2 transition-colors hover:bg-black/25"
    >
      <span
        className="text-[10px] uppercase tracking-[0.2em] text-foreground/80"
        style={{ textShadow: SHADOW_BODY }}
      >
        Signature game
      </span>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span
          className="text-4xl font-semibold tabular-nums text-foreground sm:text-5xl"
          style={{ textShadow: SHADOW_MASTHEAD }}
        >
          {signature.kills} / {signature.deaths} / {signature.assists}
        </span>
        {signature.opponentChampion ? (
          <span
            className="text-base text-foreground/85 sm:text-lg"
            style={{ textShadow: SHADOW_BODY }}
          >
            vs{" "}
            <span className="font-medium italic text-foreground/95">
              {championName(signature.opponentChampion)}
            </span>
          </span>
        ) : null}
      </div>
      <div
        // Bumped from text-foreground/70 + SHADOW_LABEL to /85 + SHADOW_BODY.
        // Small text on a busy splash needs the heavier shadow to stay
        // legible across both bright (Risen / Immortalized) and saturated
        // (Spirit Blossom / After Hours) art crops.
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/85"
        style={{ textShadow: SHADOW_BODY }}
      >
        <span
          className={[
            "font-semibold uppercase tracking-wide",
            signature.win ? "text-emerald-300" : "text-rose-300",
          ].join(" ")}
        >
          {signature.win ? "Win" : "Loss"}
        </span>
        <span aria-hidden="true" className="text-foreground/40">
          ·
        </span>
        <span className="tabular-nums">{minutes}m</span>
        <span aria-hidden="true" className="text-foreground/40">
          ·
        </span>
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
  // Parse the pre-formatted display value (e.g. "55%", "3.22", "3 games")
  // back into its numeric target so the chip can count up. Em-dash zero-
  // state ("—") and anything else non-numeric returns null and falls
  // through to a static render. Count-up fires after the chip's own
  // ChapterReveal entrance has settled — reveal default duration is 0.6s,
  // a small ~0.1s settle keeps the animation from competing with the
  // fade+rise still in flight.
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
 * Beat-2 receipts caption — italic prose line that surfaces the supporting
 * peaks data that doesn't earn a primary chip slot. Mirrors Steam beat 2's
 * `SecondaryStatsCaption`: a series of fact fragments joined by middle
 * dots, each fact only rendering when its source value is meaningful.
 *
 * The five available peaks all play different roles:
 * - `highestKills` / `highestDamageShare` — solo-carry peak receipts
 * - `aboveFiveKillsRate` — kill-volume consistency over the corpus
 * - `firstBloodRate` — early-aggression signature
 * - `avgGoldDiffAt15` — lane-phase win signal (positive = ahead at 15)
 *
 * Rendered as one italic line that wraps as needed at smaller viewports —
 * the prose register handles wrapping more gracefully than a chip strip
 * would. Numbers are bold so the eye lands on the fact, not the
 * connective tissue. Suppressed entirely when no fact passes the
 * "meaningful" gate (totalGames === 0 zero-state).
 */
function PeaksCaption({
  active,
  delay,
  peaks,
}: {
  active: boolean;
  delay: number;
  peaks: ChampionRecap["peaks"];
}) {
  const parts: ReactNode[] = [];
  if (peaks.highestKills > 0) {
    parts.push(
      <>
        Up to <strong className="text-foreground">{peaks.highestKills}</strong> kills
      </>
    );
  }
  if (peaks.highestDamageShare > 0) {
    parts.push(
      <>
        <strong className="text-foreground">
          {Math.round(peaks.highestDamageShare * 100)}%
        </strong>{" "}
        best damage share
      </>
    );
  }
  if (peaks.aboveFiveKillsRate > 0) {
    parts.push(
      <>
        5+ kills in{" "}
        <strong className="text-foreground">
          {Math.round(peaks.aboveFiveKillsRate * 100)}%
        </strong>{" "}
        of games
      </>
    );
  }
  if (peaks.firstBloodRate > 0) {
    parts.push(
      <>
        first blood{" "}
        <strong className="text-foreground">
          {Math.round(peaks.firstBloodRate * 100)}%
        </strong>
      </>
    );
  }
  if (peaks.avgGoldDiffAt15 >= 50) {
    // Positive lane-phase signal only. The peaks caption is the receipts
    // band — facts that BACK the verdict, not facts about the corpus
    // generally. Surfacing a deficit ("-966g at 15 on average") under a
    // chapter titled "vyoh's Ahri" reads as undercutting the self-
    // portrait, which is what this surface exists to be. If the lane-
    // phase signal isn't a win, drop it; the verdict prose above already
    // sets the honest tone for the chapter.
    //
    // Sub-50g averages also suppress — that's noise inside any single
    // game's variance (a tick of jungle vs. an extra wave) and doesn't
    // tell a clean story regardless of sign.
    const lead = Math.round(peaks.avgGoldDiffAt15);
    parts.push(
      <>
        <strong className="text-foreground">+{lead}g</strong> lead at 15
      </>
    );
  }
  if (parts.length === 0) return null;
  return (
    <ChapterReveal active={active} delay={delay}>
      <p
        className="text-balance text-sm italic text-foreground/85 sm:text-base"
        style={{
          textShadow: SHADOW_BODY,
        }}
      >
        {parts.map((part, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fact order is stable across renders
          <span key={i}>
            {i > 0 ? (
              <span aria-hidden="true" className="px-2 text-foreground/40">
                ·
              </span>
            ) : null}
            {part}
          </span>
        ))}
      </p>
    </ChapterReveal>
  );
}

/**
 * Streak eyebrow — only rendered when the recent-state streak is long
 * enough to be its own signal (the deriver returns `null` for counts < 2,
 * so any non-null streak qualifies). Sits above the peaks caption in beat
 * 2's detail band as the "right now" anchor to the otherwise career-
 * shaped numbers below it. Color follows the chapter accent for wins,
 * desaturated foreground for losses — wins are the celebratory case the
 * accent token exists for.
 */
function StreakEyebrow({
  active,
  delay,
  streak,
}: {
  active: boolean;
  delay: number;
  streak: NonNullable<ChampionRecap["streak"]>;
}) {
  const label = `${streak.type === "win" ? "W" : "L"}${streak.count} streak`;
  const isWin = streak.type === "win";
  return (
    <ChapterReveal active={active} delay={delay} blur={4}>
      <p className="text-xs font-medium uppercase tracking-[0.22em]">
        <span
          style={
            isWin
              ? {
                  color: "var(--accent, currentColor)",
                  paintOrder: "stroke",
                  WebkitTextStroke: STROKE_LABEL,
                  textShadow: SHADOW_ACCENT,
                }
              : {
                  color: "rgb(255 255 255 / 0.65)",
                  paintOrder: "stroke",
                  WebkitTextStroke: STROKE_LABEL,
                  textShadow: SHADOW_LABEL,
                }
          }
        >
          {label}
        </span>
      </p>
    </ChapterReveal>
  );
}

/**
 * Persistent chapter masthead — mirrors `SteamChapterTitleCard`. Lives in
 * `ChapterMultiBeat`'s identity slot so the eyebrow + champion masthead
 * stay visible across all three beats, while beat bodies slide
 * horizontally underneath.
 *
 * Two layers of presence (same pattern as Steam):
 * - `nudged` (live, from `useChapterGroupNudge`) — drives a fast outer
 *   opacity fade for exit + re-entry transitions.
 * - `hasEntered` (one-shot) — flips true the first time `nudged` goes
 *   true and never resets, so the editorial blur-rise cascade plays
 *   exactly once on first chapter entry. A quick back-scroll re-fires the
 *   outer opacity but not the per-element cascade — the masthead reveal
 *   alone is 0.18s + 1.1s = 1.28s, longer than a typical back-scroll
 *   pause; re-running it would lag behind the reader.
 */
function AhriChapterMasthead({
  eyebrow,
  skinLabel,
  displayName,
  accountSlug,
}: {
  eyebrow: string;
  skinLabel: string | null;
  displayName: string;
  accountSlug: string;
}) {
  const nudged = useChapterGroupNudge();
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => {
    if (nudged && !hasEntered) setHasEntered(true);
  }, [nudged, hasEntered]);
  return (
    <motion.div
      initial={false}
      animate={{ opacity: nudged ? 1 : 0 }}
      // 0.2s outer fade for back/forward chapter transitions — matches the
      // Steam title-card timing so the two chapter types feel coherent.
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
          {skinLabel ? (
            <>
              {/* Skin label hides below sm:. Auto-cycling rotation through
                  long-named skins ("After Hours Spirit Blossom Springs")
                  wraps the eyebrow row to a second line on narrow
                  viewports, which shifts every subsequent band each time
                  the rotation ticks. On sm+ the row fits without
                  wrapping; on smaller viewports the rotation still drives
                  the backdrop, just without the label kicker. */}
              <span
                aria-hidden="true"
                className="hidden text-foreground/40 sm:inline"
                style={{ textShadow: SHADOW_LABEL }}
              >
                ·
              </span>
              <span
                className="hidden text-foreground/75 sm:inline"
                style={{ textShadow: SHADOW_LABEL }}
              >
                {skinLabel}
              </span>
            </>
          ) : null}
          <span
            aria-hidden="true"
            className="text-foreground/40"
            style={{ textShadow: SHADOW_LABEL }}
          >
            ·
          </span>
          <ChapterShareButton chapter="champion" title={eyebrow} />
        </p>
      </ChapterReveal>
      <ChapterReveal active={hasEntered} delay={0.18} duration={1.1} blur={16} rise={20}>
        {/* Masthead-as-link: the chapter title IS the entry point to the
            deep-stats page, magazine-style. Group-hover affordance lives
            in the deep-stats route's hover state; here the link wraps
            the whole baseline. */}
        <Link
          to="/lol/$accountSlug/champions/$championKey"
          params={{
            accountSlug,
            championKey: CHAMPION_ALIAS.toLowerCase(),
          }}
          className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
        >
          <h2
            className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
            style={{ textShadow: SHADOW_MASTHEAD }}
          >
            {displayName}
          </h2>
          <p
            className="text-base italic text-foreground/80 sm:text-lg"
            style={{ textShadow: SHADOW_LABEL }}
          >
            {CHAMPION_TITLE}
          </p>
        </Link>
      </ChapterReveal>
    </motion.div>
  );
}

/**
 * Recap chapter for the LoL OTP (R-2 → R-14). Renders the Ahri subject as
 * an editorial multi-beat chapter: a persistent masthead pins at the top
 * of the chapter stage (eyebrow + champion title-as-link), and three
 * beats slide in horizontally underneath as the user scrolls through the
 * chapter:
 * - Beat 0 — verdict prose with an opener accent slash kicker
 * - Beat 1 — signature game + recent matches strip
 * - Beat 2 — peak chips + closer accent slash
 *
 * The splash is the canvas; band content floats with editorial shadow
 * tiers only where copy sits. The chapter publishes its splash via
 * `useAssetClaim` so the shared atmosphere layer paints it full-bleed;
 * skin rotation cycles via `useSkinRotation` independently of scroll, and
 * the rotation gates on `useChapterNudge` so the first swap can't land
 * during the chapter's opening cascade. Beat counts intentionally differ
 * from Steam (4) because Ahri is content-leaner; reaching for a 4th beat
 * would be filler.
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

  // Polite one-shot nudge into the chapter pin. See `useChapterNudge` for
  // the threshold + settle tuning notes. Declared here (above the rotation)
  // so it can gate the splash rotation — otherwise the rotation timer
  // starts on mount and can fire a swap mid-reveal-cascade as the user
  // scrolls in.
  const nudged = useChapterNudge(outerRef);

  // Auto-cycling rotation — timer-driven, not scroll-coupled. The earlier
  // progress-driven version mapped fast scrolls to rapid skin swaps, which
  // read as chaotic instead of ambient. Auto-cycle keeps the background
  // passive while scroll position drives only the reveal animations.
  // Gated on `nudged` so the first swap can't land during the chapter's
  // opening cascade — the user sees a stable base splash until they've
  // landed inside the chapter, then the rotation begins after the
  // standard `HOLD_MS` initial hold.
  const rotation = useSkinRotation(AHRI_SKIN_ROTATION.length, nudged);
  const activeSkin = AHRI_SKIN_ROTATION[rotation.activeIndex] ??
    AHRI_SKIN_ROTATION[0] ?? { name: "Base" };
  // `imageUrl` override wins when set; falls back to the proxy-served base
  // splash. Once the image proxy gains skin-index support, this composes
  // through it instead of a free-form override URL.
  const splashUrl =
    activeSkin.imageUrl ?? championBackdropSplashUrl(CHAMPION_ALIAS, patch);

  const palette = useMemo(() => paletteForHour(currentBrusselsHour()), []);

  // Critical-path: Ahri is the first chapter in the recap stream, so its
  // base splash gets a `<link rel="preload">` the moment the URL is known.
  // The link enters the browser's preload queue ahead of script-created
  // `Image()` fetches, eliminating the snap-in flash that would otherwise
  // appear if the chapter pinned before the asset was cached.
  const baseSplashUrl = useMemo(
    () =>
      AHRI_SKIN_ROTATION[0]?.imageUrl ?? championBackdropSplashUrl(CHAMPION_ALIAS, patch),
    [patch]
  );
  useEffect(() => preloadLinkAsImage(baseSplashUrl), [baseSplashUrl]);

  // Rotation skins (positions 1+) are lazy — they only need to be in cache
  // by the time the auto-cycle ticks to them (~5s in). `useAssetPreload`
  // gates the fetch on viewport proximity so they don't contend with the
  // critical-path base splash during initial page load. By the time the
  // chapter approaches the viewport the user has decisively engaged with
  // the page and the rotation will fire shortly after.
  const rotationSkinUrls = useMemo(
    () =>
      AHRI_SKIN_ROTATION.slice(1)
        .map((s) => s.imageUrl)
        .filter((u): u is string => Boolean(u)),
    []
  );
  useAssetPreload(outerRef, rotationSkinUrls);
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
  // Caret label is decoupled from the chapter's own eyebrow header. The
  // eyebrow ("VYOH'S AHRI") is the chapter's masthead — informative,
  // declarative. The caret is a separate affordance pointing INTO the
  // chapter and uses Ahri's own in-game quote — a teasing "follow me"
  // line that doubles as a literal scroll prompt. Voice-led rather than
  // descriptive, only works because the chapter that follows IS about
  // her; per-champion chapters will need their own quote when added.
  const caretLabel = "Try to keep up";
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

  // Tighten band padding inside each beat. ChapterOpener/Detail/Stats
  // default to vertical padding intended for stacked bands within one
  // pinned viewport (R-2 single-pin layout). In a multi-beat track each
  // beat IS one viewport and the bands no longer stack vertically, so
  // the breathing-room defaults read as wasted space. Same idiom as the
  // Steam chapter's `BEAT_LAYOUT`.
  //
  // Horizontal padding lives *inside* the `max-w-4xl` band box, not on
  // the outer flex wrapper, so the band's effective reading-column edges
  // line up with the chapter masthead's 4xl box (which also carries its
  // px inside the 4xl wrapper, see `ChapterMultiBeat`'s identity slot).
  // Without this, beat content's reading column was 2 × px wider than
  // the masthead — the title sat indented from the verdict prose below.
  const BEAT_LAYOUT =
    "flex flex-col items-center justify-start [&>[data-band]]:!max-w-4xl [&>[data-band]]:!w-full [&>[data-band]]:!px-6 sm:[&>[data-band]]:!px-10 [&>[data-band]]:!pt-8 [&>[data-band]]:!pb-6";

  // Beat bodies as render-prop functions — `nudged` is per-beat active
  // state from `<MultiBeat>` so each beat's reveal cascade fires when its
  // beat becomes the focal viewport, not at chapter entrance.
  const beatBodies: Array<(nudged: boolean) => ReactNode> = [
    // Beat 0 — Verdict prose with opener accent slash. Mirrors Steam beat
    // 0 exactly: editorial kicker slash draws in from the left (delay
    // 0.05s, lands at ~0.75s), then the verdict prose blur-rises beneath
    // it. The masthead lives in the identity slot above and is already
    // settled by the time this beat becomes focal, so beat 0 only owns
    // the verdict — no eyebrow / heading duplication.
    (nudged) => (
      <ChapterOpener>
        {verdictClauses.length > 0 ? (
          <div className="flex w-full flex-col">
            <BeatAccentSlash
              beatIndex={0}
              delay={0.05}
              className="mb-3 sm:mb-4"
              width="14rem"
            />
            <ChapterReveal active={nudged} delay={0.8} blur={8} rise={22} duration={0.9}>
              <VerdictProse
                clauses={verdictClauses}
                style={{ textShadow: SHADOW_BODY }}
                emphasisStyle={{
                  paintOrder: "stroke",
                  WebkitTextStroke: STROKE_ACCENT,
                  textShadow: SHADOW_ACCENT,
                }}
                // Count-up fires after the prose ChapterReveal entrance
                // (delay 0.8s + duration 0.9s + 0.15s settle = 1.85s).
                // Matches Steam beat 0's timing.
                numbersActive={nudged}
                numbersDelay={1.85}
                // First-word kinetic (R-12.8): the verdict's hero word
                // (first emphasis like "AGGRESSIVE", fallback subject)
                // shrink-blurs into the prose. Delay 1.0 starts the
                // kinetic ~0.2s into the parent ChapterReveal (delay
                // 0.8, duration 0.9) — by then the prose is partially
                // visible, so the eye sees the lead word distinctly
                // shrinking from a bigger-blurrier state to settle as
                // the rest of the prose finishes fading in. Lands the
                // word slightly after the parent settles.
                firstWordKinetic={nudged}
                firstWordKineticDelay={1.0}
              />
            </ChapterReveal>
          </div>
        ) : null}
      </ChapterOpener>
    ),

    // Beat 1 — Signature game + recent matches.
    //
    // Two-stage entrance instead of the templated slide-from-side cascade
    // both Steam and Ahri shared pre-R-12. The signature game is the
    // anchor — it gets a HERO-tier scale + blur entrance (scale 0.9 +
    // blur 4, 0.85s duration, HERO_EASE) so it lands with weight, like a
    // photo settling onto a magazine spread. The recent rows beneath
    // cascade in via a softer **blur-dissolve** rather than a horizontal
    // slide — opacity + slight rise + blur 3, no translateX. Reads as
    // the list "materializing into place" rather than being shuffled in
    // from off-page, which had become the most-tired chapter entrance
    // pattern (per R-12 polish review).
    (nudged) => (
      <ChapterDetail>
        {signature ? (
          <ChapterReveal
            active={nudged}
            delay={0.05}
            // Hero-tier entrance: drop the slideX in favor of scale +
            // blur. The signature game block is the visual anchor, so
            // landing weight comes from depth (blur clearing) + presence
            // (scale resolving), not from horizontal motion.
            scale={0.9}
            blur={4}
            rise={16}
            duration={0.85}
          >
            <SignatureGameBlock
              accountSlug={account.slug}
              signature={signature}
              championName={championName}
            />
          </ChapterReveal>
        ) : null}

        {recent.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <ChapterReveal active={nudged} delay={0.2}>
              <h3
                className="text-[10px] uppercase tracking-[0.2em] text-foreground/80"
                style={{ textShadow: SHADOW_BODY }}
              >
                Recent matches
              </h3>
            </ChapterReveal>
            <ul className="flex flex-col gap-0.5">
              {recent.map((m, i) => {
                const delay = 0.28 + i * 0.05;
                const minutes = Math.max(1, Math.round(m.durationSec / 60));
                const showRole = isRolePosition(m.position);
                const opponentName = m.opponentChampion
                  ? championName(m.opponentChampion)
                  : null;
                return (
                  <li key={m.matchId}>
                    {/* Blur-dissolve cascade — rise + soft blur, no
                        translateX. Replaces the prior slideX=18 horizontal
                        cascade which read as templated against every
                        other multi-beat row strip. */}
                    <ChapterReveal active={nudged} delay={delay} rise={6} blur={3}>
                      <Link
                        to="/lol/$accountSlug/matches/$matchId"
                        params={{
                          accountSlug: account.slug,
                          matchId: m.matchId,
                        }}
                        // Hover affordance: a faint full-row dark band
                        // so the user can tell which row their pointer
                        // is on. `bg-black/25` over the splash reads
                        // calmer than the previous `bg-white/8` lift
                        // (white-on-bright-splash washed out). `-mx-2
                        // px-2` lets the band extend past the row's
                        // natural padding.
                        className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-foreground/95 transition-colors hover:bg-black/25 hover:text-foreground"
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
                        <span className="w-16 shrink-0 font-mono text-xs tabular-nums text-foreground">
                          {m.kills}/{m.deaths}/{m.assists}
                        </span>
                        {/* Identity column — role icon + opponent. Role
                            icon leads as a glyph "stamp" that aligns
                            with the W/L pill and KDA on the left,
                            giving the strip a clean vertical rhythm.
                            `min-w-0 flex-1` on the truncate lets long
                            champion names ("Aurelion Sol") collapse to
                            ellipsis instead of overflowing — flex items
                            default to min-width:auto (content size),
                            which silently blocks truncation. */}
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-foreground/85">
                          {showRole ? (
                            <RoleIcon
                              position={m.position as RolePosition}
                              className="size-3.5 shrink-0 opacity-85"
                            />
                          ) : null}
                          {opponentName ? (
                            <span className="min-w-0 flex-1 truncate">
                              vs{" "}
                              <span className="font-medium italic text-foreground/95">
                                {opponentName}
                              </span>
                            </span>
                          ) : null}
                        </span>
                        {/* Meta column — duration · days-ago. Both
                            fields describe the same row from the same
                            angle (how long, how long ago), so the dot
                            belongs between them as a peer separator
                            rather than stranded between opponent and
                            duration. */}
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-foreground/80 group-hover:text-foreground/95">
                          <span className="tabular-nums">{minutes}m</span>
                          <span aria-hidden="true" className="text-foreground/40">
                            ·
                          </span>
                          <span>{formatRelative(m.playedAt)}</span>
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
    ),

    // Beat 2 — Peak chips backing the verdict claim, plus a receipts band
    // surfacing the supporting peaks data (highest single-game kills /
    // damage share, lane-phase gold lead, consistency rates) that doesn't
    // earn a primary chip slot. Closes with a mirror accent slash
    // bookending beat 0's opener slash. Eyebrow + caption + slash all sit
    // in a `ChapterDetail` band so the BEAT_LAYOUT max-w-4xl + px
    // constraints apply uniformly (slash aligns to the right edge of the
    // reading column, not the viewport).
    (nudged) => (
      <>
        <ChapterStats>
          <PeakChip
            active={nudged}
            delay={0.08}
            label="Win rate"
            value={totalGames > 0 ? `${Math.round(winRate * 100)}%` : "—"}
          />
          <PeakChip
            active={nudged}
            delay={0.22}
            label="Avg KDA"
            value={totalGames > 0 ? formatKda(avgKda) : "—"}
          />
          <PeakChip
            active={nudged}
            delay={0.36}
            label="Perfect KDA"
            value={
              totalGames > 0
                ? `${perfectKdaCount} ${perfectKdaCount === 1 ? "game" : "games"}`
                : "—"
            }
          />
        </ChapterStats>
        <ChapterDetail>
          {/* Streak eyebrow — "right now" anchor above the career-shaped
              peaks caption. Suppressed when streak is null (< 2 in a row).
              Delay lands just before the caption so the eyebrow + caption
              read as a single editorial paragraph. */}
          {recap?.streak ? (
            <StreakEyebrow active={nudged} delay={0.42} streak={recap.streak} />
          ) : null}
          {/* Peaks caption — italic prose of receipts that back the chips
              above. Suppresses individual facts whose source is
              effectively zero (no games, no first bloods recorded, sub-
              50g average lead). Delay lands after the chips' count-up
              cascade (chip 3 entrance 0.36s + reveal 0.5s + small pause). */}
          {recap ? (
            <PeaksCaption active={nudged} delay={0.55} peaks={recap.peaks} />
          ) : null}
          {/* Closer slash — `from="right"` draws right-to-left, mirroring
              beat 0's left-anchored slash. `self-end` aligns to the right
              edge of the reading column. Delay lands after the caption
              has settled. */}
          <BeatAccentSlash
            beatIndex={2}
            from="right"
            delay={1.25}
            className="self-end"
            width="14rem"
          />
        </ChapterDetail>
      </>
    ),
  ];

  const masthead = (
    <AhriChapterMasthead
      eyebrow={eyebrow}
      skinLabel={skinLabel}
      displayName={displayName}
      accountSlug={account.slug}
    />
  );

  return (
    <div ref={outerRef} data-recap-chapter="ahri" data-chapter-label={caretLabel}>
      <ChapterMultiBeat slug="ahri" ariaLabel={eyebrow} identity={masthead}>
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
