import { PersonalRecord } from "@/components/personal-record";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";
import { rankEmblemUrl } from "@/lol/_shared/assets/champion-icon";
import { useRankedEmblemYear } from "@/lol/_shared/use-ranked-emblem-year";
import {
  QUEUE_TYPES,
  RANKED_QUEUE_KEY_TO_ID,
  RANKED_QUEUE_KEY_TO_TYPE,
  type RankEntry,
  formatPercent,
} from "@vyoh/shared";
import { Flame } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { TIER_COLOR, TIER_GLOW } from "./tier-colors";

// Queue rendering uses the canonical compact labels from QUEUE_TYPES ("Ranked
// Solo" / "Ranked Flex"), keyed by the League-V4 queueType string we get back
// in RankEntry rows. The two RANKED_QUEUE_KEY maps from shared bridge the
// queueType string back to the numeric queueId that QUEUE_TYPES is keyed on.
const QUEUE_LABEL: Record<string, string> = {
  [RANKED_QUEUE_KEY_TO_TYPE.solo]:
    QUEUE_TYPES[RANKED_QUEUE_KEY_TO_ID.solo] ?? "Ranked Solo",
  [RANKED_QUEUE_KEY_TO_TYPE.flex]:
    QUEUE_TYPES[RANKED_QUEUE_KEY_TO_ID.flex] ?? "Ranked Flex",
};

const QUEUE_ORDER = [RANKED_QUEUE_KEY_TO_TYPE.solo, RANKED_QUEUE_KEY_TO_TYPE.flex];
const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

function tierLabel(entry: RankEntry): string {
  const tier = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase();
  const division = APEX_TIERS.has(entry.tier) ? "" : ` ${entry.rank}`;
  return `${tier}${division}`;
}

// One queue's column inside the strip. Ranked → emblem + tier/LP headline +
// W/L · win% + LP sparkline; unranked → a muted placeholder so both queues
// always occupy a column (the strip never reflows to one).
function RankCell({
  entry,
  recentLp,
  label,
  compact,
  reduced,
  accountSlug,
  queueKey,
}: {
  entry: RankEntry | undefined;
  recentLp: number[] | undefined;
  label: string;
  compact: boolean;
  reduced: boolean;
  accountSlug: string;
  // Per-queue scope so a solo-queue LP peak doesn't clobber the flex peak.
  // Identifier is the short key ("solo" / "flex") not the API queueType
  // string so the storageKey stays terse and the wire format is stable.
  queueKey: "solo" | "flex";
}) {
  const emblemYear = useRankedEmblemYear();

  // Crest reveal animation — replays on every `compact` flip false (so the
  // emblem lands on scroll-up from the collapsed strip, not just on mount).
  // Springs in from a smaller scale with a slight blur so it reads as the
  // tier sigil settling into place rather than popping in. Delayed slightly
  // past the strip's own fade-in (HeroRankStrip's delay 0.3 → crest delay
  // 0.42) so each crest "lands" into the strip rather than racing alongside.
  // Reduced motion: crest renders static with no transition.
  const crestReveal = {
    initial: reduced ? false : ({ opacity: 0, scale: 0.6, filter: "blur(4px)" } as const),
    animate: {
      opacity: compact ? 0 : 1,
      scale: compact ? 0.6 : 1,
      filter: compact ? "blur(4px)" : "blur(0px)",
    },
    transition: reduced
      ? { duration: 0 }
      : compact
        ? { duration: 0.18, ease: "easeOut" as const }
        : { delay: 0.42, type: "spring" as const, stiffness: 220, damping: 18 },
  };
  // Ambient drift — very slow continuous rotation that gives the settled
  // crest a sense of life without ever reading as motion. ±1.2deg over 12s
  // is below the "I see it move" threshold for most viewers but contributes
  // to the surface feeling alive. Suspended under reduced motion and while
  // compact (the crest is hidden under compact anyway).
  const ambientDrift =
    reduced || compact
      ? {}
      : {
          animate: { rotate: [0, 1.2, 0, -1.2, 0] },
          transition: {
            duration: 12,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut" as const,
          },
        };

  if (!entry) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        {/* Real Unranked crest (wiki `Season_{year}_-_Unranked.png`, resolved
            through the same rankEmblem proxy as every tier — no API change),
            desaturated + dimmed so the column has the same shape as a ranked
            one without competing. Keeps the two-column band balanced for the
            common one-queue-ranked profile instead of leaving an empty rail. */}
        <div className="flex w-20 shrink-0 justify-center sm:w-24">
          <m.div className="relative" {...crestReveal}>
            {/* Inner ambient-drift wrapper holds the rotation loop so the
                outer reveal's scale + opacity stay clean. Unranked drifts
                the same way — empty state still feels alive. */}
            <m.div {...ambientDrift}>
              {/* The Unranked crest is a near-black emblem on a dark strip, so a
                  faint neutral backlight lifts the silhouette enough to read
                  without making the empty state feel "active". */}
              <span
                aria-hidden
                className="-z-10 absolute -inset-0.5 rounded-full bg-foreground/15 opacity-50 blur-md"
              />
              <img
                src={rankEmblemUrl("UNRANKED", emblemYear)}
                alt=""
                loading="eager"
                className="size-14 object-contain opacity-55 brightness-150 grayscale sm:size-16"
              />
            </m.div>
          </m.div>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            {label}
          </span>
          <span className="font-semibold text-muted-foreground/60 text-xl">Unranked</span>
          {/* Row-parity spacer — matches the height of the ranked cell's
              "{LP} {W}W {L}L · {WR}%" stats line so a one-queue-ranked
              profile doesn't render with the unranked column floating
              short of its counterpart. */}
          <span aria-hidden className="h-5" />
        </div>
      </div>
    );
  }

  const tierColor = TIER_COLOR[entry.tier] ?? "text-foreground";
  const tierGlow = TIER_GLOW[entry.tier] ?? "bg-foreground/10";
  const { wins, losses } = entry;
  const total = wins != null && losses != null ? wins + losses : null;
  const pct =
    total != null && total > 0 && wins != null ? formatPercent(wins / total) : null;

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
      {/* Emblem in a rail that matches the avatar's footprint (w-20/24 === the
          avatar's size-20/24), so the leading emblem centers on the same
          vertical axis as the avatar above it instead of ragged-aligning to
          the card edge. The tier glow stays tight on the emblem itself. */}
      <div className="flex w-20 shrink-0 justify-center sm:w-24">
        <m.div className="relative" {...crestReveal}>
          {/* Inner ambient-drift wrapper holds the rotation loop so the
              outer reveal's scale + opacity stay clean. The tier glow rides
              along with the rotation so the whole emblem-and-halo unit
              breathes as one piece. */}
          <m.div {...ambientDrift}>
            <span
              aria-hidden
              className={cn(
                "-z-10 absolute -inset-0.5 rounded-full opacity-[0.22] blur-md",
                tierGlow
              )}
            />
            <img
              src={rankEmblemUrl(entry.tier, emblemYear)}
              alt=""
              loading="eager"
              className="size-14 object-contain drop-shadow-md sm:size-16"
            />
          </m.div>
        </m.div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </span>
          {entry.hotStreak && (
            <Flame className="size-3 shrink-0 text-orange-400 drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]" />
          )}
        </div>
        <span className={cn("font-semibold text-xl tracking-tight", tierColor)}>
          {tierLabel(entry)}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {accountSlug ? (
              <PersonalRecord
                storageKey={`lol:peak-lp:${queueKey}:${accountSlug}`}
                value={entry.leaguePoints}
                direction="higher-better"
              >
                {entry.leaguePoints}
              </PersonalRecord>
            ) : (
              entry.leaguePoints
            )}{" "}
            LP
          </span>
          {recentLp && recentLp.length >= 5 && (
            <Sparkline
              data={recentLp}
              width={44}
              height={11}
              className={tierColor}
              stroke="currentColor"
              aria-label={`LP trend, last ${recentLp.length} snapshots`}
              tooltip={
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">LP trend</span>
                  <span className="text-muted-foreground">
                    last {recentLp.length} snapshots
                  </span>
                  <span className="font-mono tabular-nums">
                    {recentLp[0]} → {recentLp[recentLp.length - 1]} (min{" "}
                    {Math.min(...recentLp)} · max {Math.max(...recentLp)})
                  </span>
                </div>
              }
            />
          )}
          {wins != null && losses != null && (
            <span className="tabular-nums">
              {wins}W {losses}L{pct != null ? ` · ${pct}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Frosted-glass rank strip pinned to the bottom of the cinematic hero card.
// Both ranked queues live here as one performance band — rank + LP + W/L +
// win% + LP trend — so the profile has a single rank surface (no separate
// tiles below) and the splash gets the full card height above it. The blur +
// scrim keep it legible over busy splash art. Hidden when the hero collapses
// to the compact strip on scroll (`compact`), matching the identity fade.
export function HeroRankStrip({
  entries,
  recentLpByQueue,
  compact,
  accountSlug,
}: {
  entries: RankEntry[];
  recentLpByQueue?: Record<string, number[]> | undefined;
  compact: boolean;
  // Optional so existing call sites without account context still render —
  // when missing, the PersonalRecord wrap is skipped and LP renders bare.
  accountSlug?: string | undefined;
}) {
  const reduced = useReducedMotion();
  const byQueue = new Map(entries.map((e) => [e.queueId, e]));
  // Map the QueueType string back to the short "solo"/"flex" key for the
  // storage scope. Anchored on RANKED_QUEUE_KEY_TO_TYPE so it stays in sync
  // with the shared queue-id constants instead of stringly-matching.
  const queueIdToKey: Record<string, "solo" | "flex"> = {
    [RANKED_QUEUE_KEY_TO_TYPE.solo]: "solo",
    [RANKED_QUEUE_KEY_TO_TYPE.flex]: "flex",
  };

  return (
    <m.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: compact ? 0 : 1 }}
      transition={reduced ? { duration: 0 } : { delay: compact ? 0 : 0.3, duration: 0.3 }}
      className="relative flex flex-col gap-4 border-white/10 border-t bg-background/20 px-6 py-4 backdrop-blur-xs sm:flex-row sm:gap-6"
    >
      {QUEUE_ORDER.map((queueId) => (
        <RankCell
          key={queueId}
          entry={byQueue.get(queueId)}
          recentLp={recentLpByQueue?.[queueId]}
          label={QUEUE_LABEL[queueId] ?? queueId}
          compact={compact}
          reduced={!!reduced}
          accountSlug={accountSlug ?? ""}
          queueKey={queueIdToKey[queueId] ?? "solo"}
        />
      ))}
    </m.div>
  );
}
