import { CsIcon, GoldIcon, VisionIcon } from "@/components/game-icons";
import { PersonalRecord } from "@/components/personal-record";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/assets/champion-square-icon";
import { KeystoneIcon } from "@/lol/_shared/assets/keystone-icon";
import { SummonerSpellIcon } from "@/lol/_shared/assets/summoner-spell-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link } from "@tanstack/react-router";
import {
  type ParticipantDetail,
  RANKED_QUEUE_IDS,
  type ScoreGrade,
  type ScoreOfGame,
} from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import { ItemSlots } from "./item-slots";
import { teamRow } from "./recap-motion";
import { SegmentedDamageBar } from "./segmented-damage-bar";
import { StatBar } from "./stat-bar";

// Restraint on purpose: only the top three tiers get a hue, the rest fade
// with the grade so a scoreboard never reads as ten coloured medals.
const GRADE_CLASS: Record<ScoreGrade, string> = {
  "S+": "text-amber-300",
  S: "text-amber-200/90",
  A: "text-emerald-300/90",
  B: "text-foreground/70",
  C: "text-foreground/50",
  D: "text-muted-foreground/60",
};

function GradeChip({ grade }: { grade: ScoreOfGame }) {
  const standing = `${grade.rank} of ${grade.outOf}`;
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>
        <span
          aria-label={`Score of game ${grade.grade}, ${standing}`}
          className={cn(
            "shrink-0 cursor-default font-mono text-[11px] font-semibold tabular-nums",
            GRADE_CLASS[grade.grade]
          )}
        >
          {grade.grade}
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          sideOffset={5}
          className={cn(TOOLTIP_CONTENT_COMPACT, "px-2.5 py-1.5 shadow-md")}
        >
          <div>Score of game · {standing}</div>
          <div className="text-muted-foreground">
            Percentile average of damage, KDA, vision, kill participation, CS and deaths
          </div>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function ParticipantRow({
  p,
  isMe,
  maxDamage,
  maxGold,
  badge,
  grade,
  accountSlug,
  skipAnimation,
  matchQueueId,
  matchDurationSec,
}: {
  p: ParticipantDetail;
  isMe?: boolean | undefined;
  maxDamage: number;
  maxGold: number;
  badge?: { label: string; tip: string } | undefined;
  grade?: ScoreOfGame | undefined;
  accountSlug: string;
  skipAnimation?: boolean | undefined;
  matchQueueId: number;
  matchDurationSec: number;
}) {
  // Personal-record gating: owner row only, ranked queues only, finite duration
  // (avoid divide-by-zero on the cs/min normalisation). Off-meta queues (ARAM,
  // draft, custom) skip the wrap so a 400-CS ARAM cheese game can't overwrite
  // the ranked record. Gate on the numeric id, never on a ranked-queue *name*:
  // League-V4 ("RANKED_SOLO_5x5") and Match-V5 ("Ranked Solo") both type as
  // `string`, so mixing them compiles, always tests false, and fails silently.
  const csPerMin = matchDurationSec > 0 ? p.csTotal / (matchDurationSec / 60) : 0;
  const showCsRecord =
    isMe && RANKED_QUEUE_IDS.includes(matchQueueId) && Number.isFinite(csPerMin);
  const championName = useChampionName();
  const reduced = useReducedMotion();
  const displayName = championName(p.championName);
  return (
    <m.li
      variants={teamRow}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card/60 p-2 backdrop-blur-sm transition-colors",
        isMe && "relative border-foreground/40 bg-card/80 ring-2 ring-foreground/30"
      )}
    >
      {isMe && !reduced && (
        <m.div
          className="pointer-events-none absolute inset-0 rounded-md"
          animate={{
            boxShadow: [
              "0 0 0 2px rgba(255,255,255,0)",
              "0 0 0 2px rgba(255,255,255,0.2), 0 0 14px 2px rgba(255,255,255,0.06)",
              "0 0 0 2px rgba(255,255,255,0)",
            ],
          }}
          transition={{
            duration: 2.8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 0.8,
          }}
        />
      )}
      {/* Champion icon + level badge */}
      <Link
        to="/lol/$accountSlug/champions/$championKey"
        params={{ accountSlug, championKey: p.championName.toLowerCase() }}
        className="relative shrink-0"
      >
        <ChampionSquareIcon
          championName={p.championName}
          alt={displayName}
          className="size-9 rounded-md"
        />
        <span className="absolute -bottom-0.5 -right-0.5 min-w-[14px] rounded border border-border/60 bg-background/90 px-0.5 text-center font-mono text-[9px] leading-[14px] tabular-nums text-muted-foreground">
          {p.championLevel}
        </span>
      </Link>
      {/* Summoner spells */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <SummonerSpellIcon id={p.summoner1Id} />
        <SummonerSpellIcon id={p.summoner2Id} />
      </div>
      {/* Keystone */}
      <KeystoneIcon id={p.keystone} />
      {/* Name + stats */}
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="truncate text-sm font-medium">{displayName}</div>
          {grade && <GradeChip grade={grade} />}
          {badge && (
            <TooltipPrimitive.Root delayDuration={300}>
              <TooltipPrimitive.Trigger asChild>
                <span className="shrink-0 cursor-default rounded px-1 py-px text-[10px] font-medium bg-foreground/[0.07] text-foreground/50">
                  {badge.label}
                </span>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="top"
                  sideOffset={5}
                  className={cn(TOOLTIP_CONTENT_COMPACT, "px-2.5 py-1.5 shadow-md")}
                >
                  {badge.tip}
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          )}
        </div>
        <div className="truncate text-[10px] text-muted-foreground/60">
          {p.riotIdGameName}
          <span className="text-muted-foreground/40">#{p.riotIdTagline}</span>
        </div>
        <div className="font-mono text-xs tabular-nums">
          <span className="whitespace-nowrap">
            <span className="text-emerald-400">{p.kills}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-red-400">{p.deaths}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-amber-400">{p.assists}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
          <TooltipPrimitive.Root delayDuration={300}>
            <TooltipPrimitive.Trigger asChild>
              <span className="flex cursor-default items-center gap-0.5 text-muted-foreground">
                <CsIcon className="size-3" />
                {showCsRecord ? (
                  <PersonalRecord
                    storageKey={`lol:match-cs-per-min:ranked:${accountSlug}`}
                    value={csPerMin}
                    direction="higher-better"
                  >
                    {p.csTotal}
                  </PersonalRecord>
                ) : (
                  p.csTotal
                )}
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={5}
                className={cn(TOOLTIP_CONTENT_COMPACT, "px-2.5 py-1.5 shadow-md")}
              >
                Creep score — minions and jungle monsters killed
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
          <TooltipPrimitive.Root delayDuration={300}>
            <TooltipPrimitive.Trigger asChild>
              <span className="flex cursor-default items-center gap-0.5 text-muted-foreground">
                <VisionIcon className="size-3" />
                {p.visionScore}
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={5}
                className={cn(TOOLTIP_CONTENT_COMPACT, "px-2.5 py-1.5 shadow-md")}
              >
                Vision score — wards placed, wards killed, and time providing vision
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <ItemSlots items={p.items} skipAnimation={skipAnimation} />
        <div className="flex flex-col gap-0.5">
          <SegmentedDamageBar
            physical={p.damageDealtPhysical}
            magic={p.damageDealtMagic}
            trueDmg={p.damageDealtTrue}
            max={maxDamage}
            skipAnimation={skipAnimation}
          />
          <StatBar
            Icon={GoldIcon}
            label="Gld"
            value={p.goldEarned}
            max={maxGold}
            fillClassName="bg-gradient-to-r from-amber-500/80 to-yellow-300/80"
            labelClassName="text-amber-400/80"
            skipAnimation={skipAnimation}
          />
        </div>
      </div>
    </m.li>
  );
}
