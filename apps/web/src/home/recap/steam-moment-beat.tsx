import { Link } from "@tanstack/react-router";
import type {
  SteamAchievementClusterStats,
  SteamFirstTimeStats,
  SteamMomentChapterDescriptor,
} from "@vyoh/shared";
import { formatPlaytime, formatReleaseDateChip } from "@vyoh/shared";
import { Award, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { steamLibraryLogoUrl } from "@/steam/_shared/steam-image";
import { useSteamGameRecap } from "@/steam/use-steam-game-recap";

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

type MomentType = SteamMomentChapterDescriptor["momentType"];

interface MomentCopy {
  eyebrow: string;
  mastheadText: string;
  /** Visual element rendered inline before the masthead text — gives each
   *  momentType a recognisable silhouette before the prose lands (R-7h.2).
   *  FIRST_TIME_GAME → Sparkles, ACHIEVEMENT_CLUSTER → Award. Null when the
   *  momentType is text-only. */
  leadingVisual: ReactNode | null;
  chapterLabel: string;
  ariaLabel: string;
  body: ReactNode;
}

/** Accent span shared across momentType prose — paint-order outline against
 *  the hero backdrop, italic for emphasis. `className` overrides the default
 *  `text-foreground/95` colour so per-momentType accent tints (R-7h.1) flow
 *  through every Accent call site. Matches the LoL moment chapter's Accent
 *  so both moment kinds read as one editorial family. */
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
  cluster: SteamAchievementClusterStats | null;
  accentClass: string;
}): MomentCopy {
  const { momentType, name, firstTime, cluster, accentClass } = args;
  if (momentType === "FIRST_TIME_GAME") {
    const playLine = firstTime ? formatPlaytime(firstTime.windowPlayMinutes) : null;
    return {
      eyebrow: "First time on",
      mastheadText: name,
      // Sparkles glyph reads as "freshness / brand-new" without competing
      // with the hero backdrop. Sized to match the masthead text-6xl;
      // accent-coloured via the per-momentType class so it ties to the
      // eyebrow signature. `aria-hidden` because the chapter eyebrow
      // already states "First time on", so the SR reading isn't doubled.
      leadingVisual: (
        <Sparkles
          aria-hidden="true"
          className={`size-16 shrink-0 ${accentClass} drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-20`}
          strokeWidth={1.5}
        />
      ),
      chapterLabel: "First time",
      ariaLabel: `First time playing ${name}`,
      body: firstTimeBody({ firstTime, playLine, accentClass }),
    };
  }
  // ACHIEVEMENT_CLUSTER — the cluster receipt is the chapter's narrative
  // seed. Three editorial registers based on span: tight reads as a
  // session run, half-day reads as an afternoon, full day reads as a
  // binge. `unlockCount` and `spanHours` drive the prose; the receipt
  // strip below carries the unlock-name list.
  return {
    eyebrow: "Recent run on",
    mastheadText: name,
    // Award glyph evokes "achievement run" without committing to a specific
    // unlock-icon grid (which would require an extra schema fetch). R-7h
    // can later upgrade this to a mini-grid of cluster unlock icons once
    // the descriptor carries iconUrls.
    leadingVisual: (
      <Award
        aria-hidden="true"
        className={`size-16 shrink-0 ${accentClass} drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-20`}
        strokeWidth={1.5}
      />
    ),
    chapterLabel: "Recent run",
    ariaLabel: `Recent achievement run on ${name}`,
    body: clusterBody({ cluster, accentClass }),
  };
}

/**
 * Compose the FIRST_TIME_GAME prose body. Three editorial registers branch
 * on the gap between when the game was added to the library and when the
 * owner first launched it — same-day reads as "instant interest", a few
 * days apart reads as "made time for it after picking it up", a long gap
 * reads as "finally beat the backlog". The receipt strip below carries the
 * pacing receipt (sessions + avg + first sit-down); this paragraph carries
 * the narrative seed.
 */
function firstTimeBody({
  firstTime,
  playLine,
  accentClass,
}: {
  firstTime: SteamFirstTimeStats | null;
  playLine: string | null;
  accentClass: string;
}): ReactNode {
  const A = ({ children }: { children: ReactNode }) => (
    <Accent className={accentClass}>{children}</Accent>
  );
  if (!firstTime) {
    return playLine ? (
      <>
        Just picked this one up — already <A>{playLine}</A> in.
      </>
    ) : (
      <>Just picked this one up.</>
    );
  }
  const addedMs = Date.parse(firstTime.addedAt);
  const playedMs = Date.parse(firstTime.firstPlayedAt);
  const gapDays =
    Number.isFinite(addedMs) && Number.isFinite(playedMs)
      ? Math.max(0, Math.floor((playedMs - addedMs) / 86_400_000))
      : 0;
  const sameDay = gapDays === 0;
  const longGap = gapDays >= 14;
  const playedLabel = formatShortDate(firstTime.firstPlayedAt);
  const addedLabel = formatShortDate(firstTime.addedAt);

  if (sameDay) {
    return playLine ? (
      <>
        Picked it up <A>{playedLabel}</A> and dove right in — already <A>{playLine}</A>{" "}
        in.
      </>
    ) : (
      <>
        Picked it up <A>{playedLabel}</A> and dove right in.
      </>
    );
  }
  if (longGap) {
    return playLine ? (
      <>
        Sat in the library for a while; first launched it <A>{playedLabel}</A> — already{" "}
        <A>{playLine}</A> in.
      </>
    ) : (
      <>
        Sat in the library for a while; first launched it <A>{playedLabel}</A>.
      </>
    );
  }
  // 1–13 day gap: pair both dates so the gap reads as a chosen pause, not
  // dormancy. "Added Mon, first played Thu" frames it as a real beat.
  return playLine ? (
    <>
      Added <A>{addedLabel}</A>, first launched <A>{playedLabel}</A> — already{" "}
      <A>{playLine}</A> in.
    </>
  ) : (
    <>
      Added <A>{addedLabel}</A>, first launched <A>{playedLabel}</A>.
    </>
  );
}

/**
 * Compose the ACHIEVEMENT_CLUSTER prose body. Three editorial registers
 * branch on the cluster's `spanHours` — a tight run reads as "back-to-back
 * sit-down", an afternoon spread reads as "made an afternoon of it", a
 * full-day spread reads as "binged it across the day". `unlockCount` is
 * the loudest beat in every variant; the receipt strip below carries the
 * unlock-name list.
 */
function clusterBody({
  cluster,
  accentClass,
}: {
  cluster: SteamAchievementClusterStats | null;
  accentClass: string;
}): ReactNode {
  if (!cluster) {
    return <>Stretch of achievements stacked up.</>;
  }
  const A = ({ children }: { children: ReactNode }) => (
    <Accent className={accentClass}>{children}</Accent>
  );
  const tight = cluster.spanHours <= 2;
  const halfDay = cluster.spanHours > 2 && cluster.spanHours <= 8;
  const countSpan = (
    <>
      <A>{cluster.unlockCount} achievements</A>
    </>
  );
  if (tight) {
    return (
      <>
        {countSpan} unlocked back-to-back in <A>{formatSpanHours(cluster.spanHours)}</A>.
      </>
    );
  }
  if (halfDay) {
    return (
      <>
        Made an afternoon of it — {countSpan} in{" "}
        <A>{formatSpanHours(cluster.spanHours)}</A>.
      </>
    );
  }
  return (
    <>
      Binged it across the day — {countSpan} over{" "}
      <A>{formatSpanHours(cluster.spanHours)}</A>.
    </>
  );
}

/** "3.5h" / "45m" — a compact span label for the cluster prose. Sub-hour
 *  spans round to whole minutes; ≥1h shows a single decimal. Pair-printed
 *  with the unlock count, so a tight beat doesn't drown under a verbose
 *  duration. */
function formatSpanHours(spanHours: number): string {
  if (spanHours < 1) return `${Math.max(1, Math.round(spanHours * 60))}m`;
  return `${spanHours.toFixed(1).replace(/\.0$/, "")}h`;
}

/** "May 27"-shaped short date. Uses en-US locale for the abbreviated month
 *  name; the day is bare (no leading zero) to match editorial register. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Europe/Brussels",
  });
}

function formatDaysSince(daysSince: number): string {
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 14) return "last week";
  if (daysSince < 30) return `${Math.round(daysSince / 7)} weeks ago`;
  return `${Math.round(daysSince / 30)} months ago`;
}

/**
 * Extract the editorial subtitle from a Steam short description. The full
 * blurb is multiple sentences separated by `\r\n\r\n` paragraphs — we want
 * just the first sentence so the masthead doesn't drown under a marketing
 * paragraph. Mirrors the helper in `steam-chapter.tsx`; deliberately
 * duplicated to keep the moment chapter independent of the heavier
 * subject-chapter module.
 */
function firstSentence(short: string | null | undefined): string {
  if (!short) return "";
  const para = short.split(/\r?\n\r?\n/)[0] ?? short;
  const match = para.match(/^(.+?[.!?])(\s|$)/);
  return (match?.[1] ?? para).trim();
}

export interface SteamMomentBeatProps {
  appid: number;
  name: string;
  daysSince: number;
  slug: string;
  momentType: MomentType;
  firstTime: SteamFirstTimeStats | null;
  cluster: SteamAchievementClusterStats | null;
  /** Per-beat active signal from the surrounding `<MultiBeat>`. Gates the
   *  ChapterReveal cascade so the moment's reveal fires when this beat
   *  becomes focal, not at chapter entrance. */
  nudged: boolean;
}

/**
 * Single Steam moment rendered as a beat inside the Steam moments
 * aggregator chapter (R-12.6). Built from the prior `SteamMomentChapter`
 * single-pin — lifts out the chapter wrapper (atmosphere claim, outer
 * ref, sticky pin, hero preload) so each moment becomes a horizontal
 * beat within one shared `ChapterMultiBeat`. The aggregator publishes
 * the chapter atmosphere (palette-only — the aggregator isn't "about" any
 * one game, so no shared hero); each beat only owns its editorial
 * content.
 *
 * Per-momentType copy / leading visual / receipt all flow through
 * `momentCopy()` and the type-specific receipt blocks below. The
 * `useSteamGameRecap` per-beat query still resolves the game's tagline +
 * release-date chip — those are per-game beat content, not atmosphere
 * claim inputs.
 */
/**
 * Per-momentType entrance shape — varies the masthead/body reveal cascade
 * so the aggregator's stacked beats don't all read with the same cadence
 * (R-12.7). FIRST_TIME_GAME gets a discovery/bloom register (heavier
 * blur, slight scale entrance — the sparkle leading visual reads as
 * "new!"), ACHIEVEMENT_CLUSTER gets a slower sustained reveal that
 * matches the "across N hours" framing of the receipt.
 */
function entranceForType(momentType: MomentType) {
  switch (momentType) {
    case "FIRST_TIME_GAME":
      return {
        mastheadBlur: 20,
        mastheadRise: 26,
        mastheadDuration: 1.05,
        mastheadScale: 0.94,
        taglineDelay: 0.4,
        bodyDelay: 0.6,
        receiptDelay: 0.78,
      };
    case "ACHIEVEMENT_CLUSTER":
      return {
        mastheadBlur: 16,
        mastheadRise: 22,
        mastheadDuration: 1.3,
        taglineDelay: 0.45,
        bodyDelay: 0.7,
        receiptDelay: 0.95,
      };
    default:
      return {
        mastheadBlur: 16,
        mastheadRise: 20,
        mastheadDuration: 1.1,
        taglineDelay: 0.4,
        bodyDelay: 0.55,
        receiptDelay: 0.7,
      };
  }
}

export function SteamMomentBeat({
  appid,
  name,
  daysSince,
  slug: _slug,
  momentType,
  firstTime,
  cluster,
  nudged,
}: SteamMomentBeatProps) {
  // Per-game recap — taglines + release date for the masthead. The aggregator
  // atmosphere is palette-only, so we no longer consume `dominantHex` or
  // the subject anchor here; the query is kept exclusively for the
  // tagline + release chip.
  const recapQuery = useSteamGameRecap(appid);
  const recap = recapQuery.data;
  const tagline = useMemo(
    () => firstSentence(recap?.shortDescription),
    [recap?.shortDescription]
  );
  const accentClass = momentAccentClass(momentType);
  const copy = momentCopy({ momentType, name, firstTime, cluster, accentClass });
  const whenLine = formatDaysSince(daysSince);
  const entrance = entranceForType(momentType);
  const releaseChip = useMemo(
    () => formatReleaseDateChip(recap?.releaseDate ?? null),
    [recap?.releaseDate]
  );
  const avgSessionMinutes =
    firstTime && firstTime.sessionCount > 0
      ? Math.round(firstTime.windowPlayMinutes / firstTime.sessionCount)
      : null;

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
            {releaseChip ? (
              <>
                <span
                  aria-hidden="true"
                  className="text-foreground/40"
                  style={{ textShadow: SHADOW_LABEL }}
                >
                  ·
                </span>
                <span className="text-foreground/75" style={{ textShadow: SHADOW_LABEL }}>
                  {releaseChip}
                </span>
              </>
            ) : null}
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
          <Link
            to="/steam/game/$appid"
            params={{ appid: String(appid) }}
            className="group/masthead inline-flex w-fit cursor-pointer flex-wrap items-baseline gap-x-4 gap-y-1 rounded-md transition-opacity hover:opacity-95"
          >
            {/* Inner row pairs the optional leading visual with the H2
                    along the visual center; the outer Link stays items-
                    baseline so the trailing "open →" chip aligns to the H2's
                    text baseline. Mirrors the LoL moment chapter's masthead
                    pattern. */}
            <span className="inline-flex items-center gap-x-4">
              {copy.leadingVisual}
              {recap?.hasLogo ? (
                // Official Steam logo as the masthead — typically a
                // designed wordmark that reads more "editorial" than the
                // typographic name in helvetica-7xl. Mirrors the heavy
                // SteamChapter masthead pattern; sized to peer with the
                // leadingVisual icon (max-h matches the icon's `sm:size-20`
                // band). `alt={name}` carries the accessible label since
                // the chapter eyebrow already says "First time on" /
                // "Recent run on". Heavy drop-shadow mirrors the
                // SHADOW_MASTHEAD tier — text-shadow doesn't apply to
                // <img>, so filter:drop-shadow handles it.
                <img
                  src={steamLibraryLogoUrl(appid, recap.assetTimestamp)}
                  alt={name}
                  className="max-h-[10dvh] w-auto max-w-full object-contain sm:max-h-[14dvh]"
                  style={{
                    filter:
                      "drop-shadow(0 1px 0 rgba(0,0,0,0.9)) drop-shadow(0 0 6px rgba(0,0,0,0.85)) drop-shadow(0 2px 16px rgba(0,0,0,0.6))",
                  }}
                />
              ) : (
                <h2
                  className="text-6xl font-semibold leading-[0.95] text-foreground sm:text-7xl"
                  style={{ textShadow: SHADOW_MASTHEAD }}
                >
                  {copy.mastheadText}
                </h2>
              )}
            </span>
            <span className="text-sm italic text-foreground/70 opacity-0 transition-opacity group-hover/masthead:opacity-100">
              open →
            </span>
          </Link>
        </ChapterReveal>
        {tagline ? (
          <ChapterReveal active={nudged} delay={entrance.taglineDelay} blur={6}>
            <p
              className="max-w-prose text-base italic text-foreground/75 sm:text-lg"
              style={{ textShadow: SHADOW_BODY }}
            >
              {tagline}
            </p>
          </ChapterReveal>
        ) : null}
        <ChapterReveal active={nudged} delay={entrance.bodyDelay} blur={6}>
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
          <ChapterReveal active={nudged} delay={entrance.receiptDelay}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 sm:gap-x-6">
              {/* Multi-stat receipt: total minutes are the headline number
                      (loudest beat — "this is real engagement, not a 3-min
                      launch"), session count + average per session give the
                      reader the *rhythm* of the play. "3h · 4 sessions"
                      reads as "kept coming back this week", "3h · 1 session"
                      reads as "one long sit-down". Both stories are good
                      first-time framings; surfacing the breakdown lets the
                      page distinguish them. R-7h polish layers per-type
                      receipt shapes; this is the FIRST_TIME_GAME shape. */}
              <span
                className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
                style={{ textShadow: SHADOW_MASTHEAD }}
              >
                {formatPlaytime(firstTime.windowPlayMinutes)}
              </span>
              {firstTime.sessionCount > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    className="text-foreground/40"
                    style={{ textShadow: SHADOW_LABEL }}
                  >
                    ·
                  </span>
                  <span
                    className="text-sm tabular-nums text-foreground/80"
                    style={{ textShadow: SHADOW_BODY }}
                  >
                    {firstTime.sessionCount === 1
                      ? "1 session"
                      : `${firstTime.sessionCount} sessions`}
                  </span>
                </>
              ) : null}
              {avgSessionMinutes !== null && firstTime.sessionCount > 1 ? (
                <>
                  <span
                    aria-hidden="true"
                    className="text-foreground/40"
                    style={{ textShadow: SHADOW_LABEL }}
                  >
                    ·
                  </span>
                  <span
                    className="text-sm tabular-nums text-foreground/70"
                    style={{ textShadow: SHADOW_BODY }}
                  >
                    avg {formatPlaytime(avgSessionMinutes)}
                  </span>
                </>
              ) : null}
              {firstTime.sessionCount > 1 && firstTime.firstSessionMinutes > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    className="text-foreground/40"
                    style={{ textShadow: SHADOW_LABEL }}
                  >
                    ·
                  </span>
                  <span
                    className="text-sm tabular-nums text-foreground/70"
                    style={{ textShadow: SHADOW_BODY }}
                  >
                    first sit-down {formatPlaytime(firstTime.firstSessionMinutes)}
                  </span>
                </>
              ) : null}
            </div>
          </ChapterReveal>
        </ChapterDetail>
      ) : null}
      {cluster ? (
        <ChapterDetail>
          <ChapterReveal active={nudged} delay={entrance.receiptDelay}>
            {/* Cluster receipt: count + span are the loudest beats, the
                    unlock-name list is the editorial proof — the reader sees
                    the actual achievements that fell in the run. Truncates
                    beyond the descriptor's name-cap with "and N more"; R-7h
                    polish can replace this with an icon grid leadingVisual. */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 sm:gap-x-6">
                <span
                  className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
                  style={{ textShadow: SHADOW_MASTHEAD }}
                >
                  {cluster.unlockCount} unlocks
                </span>
                <span
                  aria-hidden="true"
                  className="text-foreground/40"
                  style={{ textShadow: SHADOW_LABEL }}
                >
                  ·
                </span>
                <span
                  className="text-sm tabular-nums text-foreground/80"
                  style={{ textShadow: SHADOW_BODY }}
                >
                  across {formatSpanHours(cluster.spanHours)}
                </span>
              </div>
              {cluster.unlockNames.length > 0 ? (
                <p
                  className="max-w-prose text-sm italic text-foreground/70"
                  style={{ textShadow: SHADOW_BODY }}
                >
                  {cluster.unlockNames.join(" · ")}
                  {cluster.unlockCount > cluster.unlockNames.length
                    ? ` · and ${cluster.unlockCount - cluster.unlockNames.length} more`
                    : null}
                </p>
              ) : null}
            </div>
          </ChapterReveal>
        </ChapterDetail>
      ) : null}
    </>
  );
}
