import { Link } from "@tanstack/react-router";
import {
  type LolAccount,
  type LolHiatusReturnStats,
  type LolKdaOutlierStats,
  type LolMarathonStats,
  type LolMomentChapterDescriptor,
  type LolMomentMatchStats,
  type LolRankUpDelta,
  type LolStreakStats,
  formatRankTitle,
} from "@vyoh/shared";
import { Clock, Hourglass, Trophy } from "lucide-react";
import type { ReactNode } from "react";

import { rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import { useChampionName } from "@/lol/champions/use-champions";

import { ChapterDetail, ChapterOpener } from "./chapter-bands";
import { ChapterReveal } from "./chapter-reveal";
import {
  SHADOW_ACCENT,
  SHADOW_BODY,
  SHADOW_LABEL,
  SHADOW_MASTHEAD,
  STROKE_ACCENT,
} from "./chapter-shadows";
import { momentAccentClass } from "./moment-accent";

/** Champion the chapter sets as the editorial baseline ("you usually play X").
 *  Used in the OFF_META_PICK prose only — the chapter opens directly on the
 *  off-meta champion's splash; the prose carries the "stepped off ANCHOR"
 *  narrative. (Earlier R-6 draft tried an Ahri→other splash dissolve as the
 *  signature beat; rejected after visual review — the chapter is about the
 *  OFF-META champion, and opening on the anchor for ~800ms read as a delay
 *  rather than a beat. The prose communicates the comparison without the
 *  visual having to re-tell it.) */
const ANCHOR_CHAMPION_ALIAS = "Ahri";

type MomentType = LolMomentChapterDescriptor["momentType"];

/** Accent span shared between every momentType's prose — paint-order outline
 *  against the splash backdrop, italic for emphasis. `className` overrides
 *  the default `text-foreground/95` colour so per-momentType accent tints
 *  (R-7h.1) flow through every Accent call site without needing per-type
 *  prose duplication. */
function Accent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-medium italic ${className ?? "text-foreground/95"}`}
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

interface MomentCopy {
  eyebrow: string;
  mastheadText: string;
  /** Visual element rendered inline before the masthead text — RANK_UP uses
   *  it to carry the destination tier emblem. Null when the momentType is
   *  text-only (OFF_META_PICK, future text-heavy moment shapes). */
  leadingVisual: ReactNode | null;
  chapterLabel: string;
  ariaLabel: string;
  body: ReactNode;
  /** Per-momentType receipt strip rendered below the prose. R-7h.3
   *  customises the shape per type so a sequence moment (STREAK, MARATHON)
   *  doesn't fall back to the W/L + KDA + duration strip designed for
   *  single-match moments. Null when the source descriptor has no
   *  matchStats and the type doesn't have its own receipt data. */
  receipt: ReactNode | null;
}

/** Default receipt — W/L pill + K/D/A + duration. Used by OFF_META_PICK
 *  and RANK_UP, where the single-match perf is the natural editorial
 *  receipt. Other momentTypes build their own receipt-shapes per R-7h.3. */
function matchStatsReceipt({ matchStats }: { matchStats: LolMomentMatchStats }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
      <span
        className={[
          "text-sm font-semibold uppercase tracking-[0.18em]",
          matchStats.win ? "text-emerald-300" : "text-rose-300",
        ].join(" ")}
        style={{ textShadow: SHADOW_ACCENT }}
      >
        {matchStats.win ? "Win" : "Loss"}
      </span>
      <span
        className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
        style={{ textShadow: SHADOW_MASTHEAD }}
      >
        {matchStats.kills} / {matchStats.deaths} / {matchStats.assists}
      </span>
      <span
        className="text-sm tabular-nums text-foreground/80"
        style={{ textShadow: SHADOW_BODY }}
      >
        {formatDuration(matchStats.durationSec)}
      </span>
    </div>
  );
}

/** Compact sub-stat: the source match's W/L + K/D/A in smaller type. Used
 *  by sequence-shaped receipts (STREAK, MARATHON, RETURN) where the lede
 *  number is the sequence beat (count, gap) and the match is editorial
 *  proof in the second register. */
function matchStatsSubstat({ matchStats }: { matchStats: LolMomentMatchStats }) {
  return (
    <span
      className={[
        "text-sm tabular-nums",
        matchStats.win ? "text-emerald-300/90" : "text-rose-300/90",
      ].join(" ")}
      style={{ textShadow: SHADOW_BODY }}
    >
      {matchStats.win ? "W" : "L"} · {matchStats.kills}/{matchStats.deaths}/
      {matchStats.assists}
    </span>
  );
}

/** Headline-number receipt — big tabular value paired with a label, with
 *  optional sub-stats. Shared by STREAK, MARATHON, RETURN, KDA_OUTLIER so
 *  each sequence/standout moment reads with the same editorial register
 *  (lede number + label + optional substat row) without duplicating
 *  styling per branch. */
function headlineReceipt({
  value,
  label,
  accentClass,
  substats,
}: {
  value: string;
  label: string;
  accentClass: string;
  substats?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 sm:gap-x-6">
      <span
        className={`text-4xl font-semibold tabular-nums ${accentClass} sm:text-5xl`}
        style={{ textShadow: SHADOW_MASTHEAD }}
      >
        {value}
      </span>
      <span
        className="text-sm uppercase tracking-[0.18em] text-foreground/75"
        style={{ textShadow: SHADOW_LABEL }}
      >
        {label}
      </span>
      {substats ? (
        <>
          <span
            aria-hidden="true"
            className="text-foreground/40"
            style={{ textShadow: SHADOW_LABEL }}
          >
            ·
          </span>
          {substats}
        </>
      ) : null}
    </div>
  );
}

/**
 * Per-momentType editorial copy + masthead text. RANK_UP and OFF_META_PICK
 * are the two implemented types; the remaining momentTypes fall through to
 * the off-meta framing until their R-7 chunks land — keeps the chapter
 * renderable while the detectors are added incrementally.
 */
function momentCopy(args: {
  momentType: MomentType;
  displayName: string;
  anchorDisplayName: string;
  rankUp: LolRankUpDelta | null;
  kdaOutlier: LolKdaOutlierStats | null;
  hiatusReturn: LolHiatusReturnStats | null;
  streak: LolStreakStats | null;
  marathon: LolMarathonStats | null;
  matchStats: LolMomentMatchStats | null;
  emblemYear: number;
  accentClass: string;
}): MomentCopy {
  const {
    momentType,
    displayName,
    anchorDisplayName,
    rankUp,
    kdaOutlier,
    hiatusReturn,
    streak,
    marathon,
    matchStats,
    emblemYear,
    accentClass,
  } = args;
  const A = ({ children }: { children: ReactNode }) => (
    <Accent className={accentClass}>{children}</Accent>
  );
  const defaultReceipt = matchStats ? matchStatsReceipt({ matchStats }) : null;

  if (momentType === "RANK_UP" && rankUp) {
    const fromTitle = formatRankTitle(rankUp.fromTier, rankUp.fromRank);
    const toTitle = formatRankTitle(rankUp.toTier, rankUp.toRank);
    return {
      eyebrow: "Rank up",
      mastheadText: toTitle,
      // Destination-tier emblem sits inline before the masthead text. The
      // emblem is decorative — the tier name is already in the masthead, so
      // alt="" keeps SR users from hearing "Gold IV image, Gold IV". Sized
      // proportional to the masthead (size-20 = 80px against text-6xl) so
      // the icon reads as a peer to the headline, not as an inline glyph.
      leadingVisual: (
        <img
          src={rankEmblemUrl(rankUp.toTier, emblemYear)}
          alt=""
          loading="eager"
          className="size-20 shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-24"
        />
      ),
      chapterLabel: `Rank up · ${toTitle}`,
      ariaLabel: `Rank up: ${toTitle}`,
      body: (
        <>
          Climbed from <A>{fromTitle}</A> to <A>{toTitle}</A>, championed by{" "}
          <A>{displayName}</A>.
        </>
      ),
      receipt: defaultReceipt,
    };
  }

  if (momentType === "MARATHON" && marathon) {
    return {
      eyebrow: "Marathon",
      mastheadText: displayName,
      // Clock evokes the marathon's "across hours, not games" shape without
      // duplicating the matchCount/spanHours numbers in the prose. Sized
      // and shadowed to match the RANK_UP emblem's visual weight.
      leadingVisual: (
        <Clock
          aria-hidden="true"
          className={`size-16 shrink-0 ${accentClass} drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-20`}
          strokeWidth={1.5}
        />
      ),
      chapterLabel: `Marathon · ${displayName}`,
      ariaLabel: `Marathon session on ${displayName}`,
      body: (
        <>
          <A>{marathon.matchCount}</A> ranked games in one sitting, capped on{" "}
          <A>{displayName}</A>.
        </>
      ),
      // Marathon receipt leads with matchCount (the chapter's load-bearing
      // number); span hours follows as the duration label. Cap match's
      // K/D/A rides along as the substat — "this is what the last sitting
      // looked like".
      receipt: headlineReceipt({
        value: String(marathon.matchCount),
        label: `games across ${marathon.spanHours}h`,
        accentClass,
        substats: matchStats ? matchStatsSubstat({ matchStats }) : undefined,
      }),
    };
  }

  if ((momentType === "STREAK_5W" || momentType === "STREAK_5L") && streak) {
    const isHot = streak.result === "W";
    // Pip row visualises the streak shape directly — one dot per game, all
    // tinted by the streak result. Capped at PIP_RENDER_CAP so a 12+ streak
    // doesn't blow up the layout; the actual count still appears in the
    // prose ("12 ranked wins in a row"). Pre-built keyed entries so the
    // streak result and position both contribute to the key (avoids
    // index-as-key while keeping the render order stable).
    const PIP_RENDER_CAP = 7;
    const renderedPips = Math.min(streak.length, PIP_RENDER_CAP);
    const pipKeys = Array.from(
      { length: renderedPips },
      (_, i) => `pip-${streak.result}-${i}`
    );
    return {
      eyebrow: isHot ? "Hot streak" : "Cold streak",
      mastheadText: displayName,
      leadingVisual: (
        <div aria-hidden="true" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {pipKeys.map((key) => (
            <span
              key={key}
              className={[
                "block size-3 rounded-full sm:size-4",
                isHot ? "bg-emerald-300" : "bg-rose-300",
                "shadow-[0_2px_8px_rgba(0,0,0,0.5)]",
              ].join(" ")}
            />
          ))}
        </div>
      ),
      chapterLabel: `${isHot ? "Hot streak" : "Cold streak"} · ${displayName}`,
      ariaLabel: `${isHot ? "Hot streak" : "Cold streak"} on ${displayName}`,
      body: isHot ? (
        <>
          <A>{streak.length}</A> ranked wins in a row, last on <A>{displayName}</A>.
        </>
      ) : (
        <>
          <A>{streak.length}</A> ranked losses straight, last on <A>{displayName}</A>.
        </>
      ),
      // Streak receipt: the count is the lede; "in a row" / "straight" the
      // editorial label. The head match's K/D/A rides along as substat —
      // the chapter narrates the run, but the last game gives the reader
      // a concrete shape for "what just happened".
      receipt: headlineReceipt({
        value: String(streak.length),
        label: isHot ? "in a row" : "straight",
        accentClass,
        substats: matchStats ? matchStatsSubstat({ matchStats }) : undefined,
      }),
    };
  }

  if (momentType === "RETURN_FROM_HIATUS" && hiatusReturn) {
    // Editorial gap formatting: short hiatuses read as days, long ones as
    // weeks/months. Keeps the prose tight — "ninety days away" reads better
    // than "90 days away" on the page.
    const gapLabel = formatHiatusGap(hiatusReturn.gapDays);
    return {
      eyebrow: "Return",
      mastheadText: displayName,
      // Hourglass evokes "time away" — the chapter's narrative seed is the
      // gap, not the return match itself. Sized + shadowed to match the
      // emblem/clock pattern.
      leadingVisual: (
        <Hourglass
          aria-hidden="true"
          className={`size-16 shrink-0 ${accentClass} drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-20`}
          strokeWidth={1.5}
        />
      ),
      chapterLabel: `Return · ${displayName}`,
      ariaLabel: `Return from hiatus on ${displayName}`,
      body: (
        <>
          <A>{gapLabel}</A> away from ranked, then back on <A>{displayName}</A>.
        </>
      ),
      // Return receipt: gap is the lede ("Three months / 35 days"), "quiet"
      // the label. Return-match K/D/A rides along as substat — what the
      // first game back looked like.
      receipt: headlineReceipt({
        value: gapLabel,
        label: "quiet",
        accentClass,
        substats: matchStats ? matchStatsSubstat({ matchStats }) : undefined,
      }),
    };
  }

  if (momentType === "KDA_OUTLIER" && kdaOutlier) {
    // matchKda / baselineKda is the editorial multiplier. Guard against
    // baseline=0 (shouldn't happen — detector requires 8+ baseline games —
    // but the chapter shouldn't show "Infinity×" if the contract is ever
    // violated).
    const factor =
      kdaOutlier.baselineKda > 0 ? kdaOutlier.matchKda / kdaOutlier.baselineKda : null;
    const matchKdaLabel = kdaOutlier.matchKda.toFixed(1);
    const factorLabel = factor ? `${factor.toFixed(1)}×` : null;
    return {
      eyebrow: "Standout game",
      mastheadText: displayName,
      // Trophy evokes "peak performance" — the chapter is about this being
      // the owner's best KDA in the window. Avoids duplicating the
      // numeric multiplier already in the prose.
      leadingVisual: (
        <Trophy
          aria-hidden="true"
          className={`size-16 shrink-0 ${accentClass} drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-20`}
          strokeWidth={1.5}
        />
      ),
      chapterLabel: `Standout · ${displayName}`,
      ariaLabel: `Standout game on ${displayName}`,
      body: (
        <>
          Posted a <A>{matchKdaLabel}</A> KDA on <A>{displayName}</A>
          {factorLabel ? (
            <>
              {" "}
              — <A>{factorLabel}</A> the 30-day baseline
            </>
          ) : null}
          .
        </>
      ),
      // Standout receipt: the standout KDA is the lede, "KDA" labels it, the
      // multiplier rides along ("5.2× baseline"). The raw K/D/A is implicit
      // in the prose so it doesn't repeat in the substat row.
      receipt: headlineReceipt({
        value: matchKdaLabel,
        label: "KDA",
        accentClass,
        substats: factorLabel ? (
          <span
            className="text-sm tabular-nums text-foreground/75"
            style={{ textShadow: SHADOW_BODY }}
          >
            {factorLabel} baseline
          </span>
        ) : undefined,
      }),
    };
  }

  return {
    eyebrow: "Off-meta pick",
    mastheadText: displayName,
    leadingVisual: null,
    chapterLabel: `Off-meta · ${displayName}`,
    ariaLabel: `Off-meta pick: ${displayName}`,
    body: (
      <>
        Stepped off <A>{anchorDisplayName}</A> for a one-off run on <A>{displayName}</A>.
      </>
    ),
    receipt: defaultReceipt,
  };
}

/** Editorial gap formatter for RETURN_FROM_HIATUS prose. Maps integer days
 *  to a human-readable phrase: weeks for short hiatuses, months for long
 *  ones. Threshold is HIATUS_THRESHOLD_DAYS (14d) on the detector side, so
 *  this never receives < 14. */
function formatHiatusGap(gapDays: number): string {
  if (gapDays < 30) {
    const weeks = Math.round(gapDays / 7);
    return weeks === 1 ? "A week" : `${weeks} weeks`;
  }
  if (gapDays < 60) return "A month";
  const months = Math.round(gapDays / 30);
  return `${months} months`;
}

function formatDaysSince(daysSince: number): string {
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 14) return "last week";
  if (daysSince < 30) return `${Math.round(daysSince / 7)} weeks ago`;
  return `${Math.round(daysSince / 30)} months ago`;
}

function formatDuration(durationSec: number): string {
  const minutes = Math.max(1, Math.round(durationSec / 60));
  return `${minutes}m`;
}

export interface LolMomentBeatProps {
  account: LolAccount;
  championAlias: string;
  matchId: string | null;
  daysSince: number;
  slug: string;
  momentType: MomentType;
  matchStats: LolMomentMatchStats | null;
  rankUp: LolRankUpDelta | null;
  kdaOutlier: LolKdaOutlierStats | null;
  hiatusReturn: LolHiatusReturnStats | null;
  streak: LolStreakStats | null;
  marathon: LolMarathonStats | null;
  /** Per-beat active signal from the surrounding `<MultiBeat>`. Gates the
   *  ChapterReveal cascade so the per-moment beat reveal fires when this
   *  beat becomes focal, not at chapter entrance. */
  nudged: boolean;
}

/**
 * Single LoL moment rendered as a beat inside the LoL moments aggregator
 * chapter (R-12.5). Built from the prior `LolMomentChapter` single-pin —
 * lifts out the chapter wrapper (atmosphere claim, outer ref, sticky pin,
 * splash preload) so each moment becomes a horizontal beat within one
 * shared `ChapterMultiBeat`. The aggregator publishes the single
 * atmosphere claim (anchor Ahri splash); each beat only owns its
 * editorial content.
 *
 * Per-moment-type copy / receipt / leading visual all flow through
 * `momentCopy()` — the only behavioral seam between standalone-chapter
 * and aggregator-beat presentation is *where* the reveal cascade is
 * gated (chapter nudge vs. per-beat nudge) and what wraps the content.
 *
 * The per-type momentTypes (RANK_UP, KDA_OUTLIER, STREAK_5W, STREAK_5L,
 * RETURN_FROM_HIATUS, MARATHON, OFF_META_PICK) each pick their own
 * eyebrow + masthead + leading visual + receipt; this function stays
 * type-agnostic, rendering whichever shape `momentCopy()` returns.
 */
/**
 * Per-momentType entrance shape — varies the masthead/body reveal cascade
 * so the aggregator's stacked beats don't all read with the same
 * cadence (R-12.7). Type-agnostic defaults (RANK_UP-as-default) keep
 * unfamiliar types pointing at the same shape AhriChapter and SteamChapter
 * use; types with a distinctive editorial register override:
 *
 *  - RETURN_FROM_HIATUS — slow re-emergence from absence. Heavier initial
 *    blur, longer duration, larger rise so the masthead "lifts out of the
 *    quiet" rather than slamming in.
 *  - MARATHON — sustained-activity register. Longer body delay so the
 *    masthead breathes; the prose lands second after the count of
 *    "{N} games" has time to register.
 *  - KDA_OUTLIER — standout peak. Slight scale entrance + tighter
 *    duration so the masthead reads as snap-to-frame.
 *  - STREAK_5W / STREAK_5L — pip-row beat. Faster body delay so the W/L
 *    pip cascade hooks the reader before the prose explanation lands.
 *  - OFF_META_PICK + RANK_UP — defaults; the matter-of-fact framing fits
 *    the standard blur-rise cascade.
 */
function entranceForType(momentType: MomentType) {
  switch (momentType) {
    case "RETURN_FROM_HIATUS":
      return {
        mastheadBlur: 22,
        mastheadRise: 28,
        mastheadDuration: 1.45,
        bodyDelay: 0.75,
        receiptDelay: 0.95,
      };
    case "MARATHON":
      return {
        mastheadBlur: 16,
        mastheadRise: 24,
        mastheadDuration: 1.2,
        bodyDelay: 0.7,
        receiptDelay: 0.9,
      };
    case "KDA_OUTLIER":
      return {
        mastheadBlur: 14,
        mastheadRise: 20,
        mastheadDuration: 0.95,
        mastheadScale: 0.94,
        bodyDelay: 0.5,
        receiptDelay: 0.65,
      };
    case "STREAK_5W":
    case "STREAK_5L":
      return {
        mastheadBlur: 14,
        mastheadRise: 18,
        mastheadDuration: 1.0,
        bodyDelay: 0.45,
        receiptDelay: 0.6,
      };
    default:
      return {
        mastheadBlur: 16,
        mastheadRise: 20,
        mastheadDuration: 1.1,
        bodyDelay: 0.55,
        receiptDelay: 0.7,
      };
  }
}

export function LolMomentBeat({
  account,
  championAlias,
  matchId,
  daysSince,
  slug: _slug,
  momentType,
  matchStats,
  rankUp,
  kdaOutlier,
  hiatusReturn,
  streak,
  marathon,
  nudged,
}: LolMomentBeatProps) {
  const championName = useChampionName();
  const displayName = championName(championAlias);
  const anchorDisplayName = championName(ANCHOR_CHAMPION_ALIAS);
  const emblemYear = useRankedEmblemYear();
  const entrance = entranceForType(momentType);
  // Per-momentType typographic accent — drives both the eyebrow colour
  // and every inline `<Accent>` span inside the prose. Aggregator
  // atmosphere accent is Ahri's dominant hex; this is the per-beat
  // typographic signature that visually differentiates moment types.
  const accentClass = momentAccentClass(momentType);
  const copy = momentCopy({
    momentType,
    displayName,
    anchorDisplayName,
    rankUp,
    kdaOutlier,
    hiatusReturn,
    streak,
    marathon,
    matchStats,
    emblemYear,
    accentClass,
  });
  const whenLine = formatDaysSince(daysSince);

  return (
    <>
      <ChapterOpener>
        <ChapterReveal active={nudged} delay={0.05} blur={4}>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium uppercase tracking-[0.18em]">
            <span
              className={accentClass}
              style={{
                paintOrder: "stroke",
                WebkitTextStroke: STROKE_ACCENT,
                textShadow: SHADOW_ACCENT,
              }}
            >
              {copy.eyebrow}
            </span>
            {matchStats?.queueType ? (
              <>
                <span
                  aria-hidden="true"
                  className="text-foreground/40"
                  style={{ textShadow: SHADOW_LABEL }}
                >
                  ·
                </span>
                <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
                  {matchStats.queueType}
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
            <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
              {whenLine}
            </span>
          </p>
        </ChapterReveal>
        <ChapterReveal
          active={nudged}
          delay={0.18}
          duration={entrance.mastheadDuration}
          blur={entrance.mastheadBlur}
          rise={entrance.mastheadRise}
          {...(entrance.mastheadScale !== undefined
            ? { scale: entrance.mastheadScale }
            : {})}
        >
          {matchId ? (
            <Link
              to="/lol/$accountSlug/matches/$matchId"
              params={{ accountSlug: account.slug, matchId }}
              className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
            >
              {/* Inner row pairs the optional leading visual with the
                  H2 along the visual center; the outer Link stays
                  items-baseline so the trailing "open →" chip aligns
                  to the H2's text baseline (correct for OFF_META_PICK
                  where there's no leadingVisual). */}
              <span className="inline-flex items-center gap-x-4">
                {copy.leadingVisual}
                <h2
                  className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                  style={{ textShadow: SHADOW_MASTHEAD }}
                >
                  {copy.mastheadText}
                </h2>
              </span>
              <span className="text-sm italic text-foreground/70 opacity-0 transition-opacity group-hover/masthead:opacity-100">
                open →
              </span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-x-4">
              {copy.leadingVisual}
              <h2
                className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                style={{ textShadow: SHADOW_MASTHEAD }}
              >
                {copy.mastheadText}
              </h2>
            </span>
          )}
        </ChapterReveal>
        <ChapterReveal active={nudged} delay={entrance.bodyDelay} blur={6}>
          <p
            className="max-w-prose text-base text-foreground/85 sm:text-lg"
            style={{ textShadow: SHADOW_BODY }}
          >
            {copy.body}
          </p>
        </ChapterReveal>
      </ChapterOpener>
      {copy.receipt ? (
        <ChapterDetail>
          <ChapterReveal active={nudged} delay={entrance.receiptDelay}>
            {/* Per-momentType receipt shape, built inside `momentCopy()`.
                OFF_META_PICK + RANK_UP fall back to the original W/L +
                K/D/A + duration strip; KDA_OUTLIER / STREAK / MARATHON /
                RETURN each lead with their own headline number. */}
            {copy.receipt}
          </ChapterReveal>
        </ChapterDetail>
      ) : null}
    </>
  );
}
