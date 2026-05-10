import {
  BaronNashorIcon,
  ChemtechDrakeIcon,
  CloudDrakeIcon,
  CrossedSwordsIcon,
  CsIcon,
  FireDrakeIcon,
  GoldIcon,
  HextechDrakeIcon,
  InhibitorIcon,
  KillsIcon,
  MountainDrakeIcon,
  OceanDrakeIcon,
  RiftHeraldIcon,
  TowerIcon,
  VisionIcon,
} from "@/components/game-icons";
import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import { ItemIcon } from "@/lol/_shared/item-icon";
import { KeystoneIcon } from "@/lol/_shared/keystone-icon";
import { useSplashChampion } from "@/lol/_shared/splash-backdrop";
import { SummonerSpellIcon } from "@/lol/_shared/summoner-spell-icon";
import { useChampionName } from "@/lol/champions/use-champions";
import { MatchBuildOrder } from "@/lol/matches/match-build-order";
import { MatchEventTimelines } from "@/lol/matches/match-event-timelines";
import { MatchGoldLead } from "@/lol/matches/match-gold-lead";
import { MatchKillMap } from "@/lol/matches/match-kill-map";
import { MatchLanePhase } from "@/lol/matches/match-lane-phase";
import { MatchSkillOrder } from "@/lol/matches/match-skill-order";
import { useItems } from "@/lol/matches/use-items";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type {
  MatchDetail,
  MatchTimelineProjection,
  ParticipantDetail,
  TeamSummary,
} from "@vyoh/shared";
import { type Variants, m, useReducedMotion } from "motion/react";
import { type ComponentType, useEffect, useState } from "react";

const itemsContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const itemReveal: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 500, damping: 26 },
  },
};

const teamContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const teamRow: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

// ---- Score-of-game badge computation ----

type BadgeKey = "damage" | "kda" | "vision" | "kp" | "cs" | "deaths";

const BADGE_DEFS: Record<BadgeKey, { label: string; tip: string }> = {
  damage: { label: "Top DMG", tip: "Most damage dealt to champions" },
  kda: { label: "Top KDA", tip: "Highest KDA ratio" },
  vision: { label: "Top Vision", tip: "Highest vision score" },
  kp: { label: "Top KP", tip: "Highest kill participation" },
  cs: { label: "Top CS", tip: "Most creep score" },
  deaths: { label: "Low Deaths", tip: "Fewest deaths in this game" },
};

function computeBadges(
  participants: ParticipantDetail[]
): Map<string, { label: string; tip: string }> {
  type Candidate = { puuid: string; key: BadgeKey; margin: number };
  const candidates: Candidate[] = [];

  function maxWinner(key: BadgeKey, getValue: (p: ParticipantDetail) => number) {
    const sorted = [...participants].sort((a, b) => getValue(b) - getValue(a));
    const best = sorted[0];
    const second = sorted[1];
    if (!best || !second) return;
    const bv = getValue(best);
    const sv = getValue(second);
    if (bv === sv) return;
    candidates.push({ puuid: best.puuid, key, margin: (bv - sv) / Math.max(bv, 1) });
  }

  function minWinner(key: BadgeKey, getValue: (p: ParticipantDetail) => number) {
    const sorted = [...participants].sort((a, b) => getValue(a) - getValue(b));
    const best = sorted[0];
    const second = sorted[1];
    if (!best || !second) return;
    const bv = getValue(best);
    const sv = getValue(second);
    if (bv === sv) return;
    const maxVal = Math.max(...participants.map(getValue), 1);
    candidates.push({ puuid: best.puuid, key, margin: (sv - bv) / maxVal });
  }

  maxWinner("damage", (p) => p.totalDamage);
  maxWinner("kda", (p) => (p.kills + p.assists) / Math.max(p.deaths, 1));
  maxWinner("vision", (p) => p.visionScore);
  maxWinner("kp", (p) => p.kp);
  maxWinner("cs", (p) => p.csTotal);
  minWinner("deaths", (p) => p.deaths);

  // Most distinctive first — greedily assign one badge per participant
  candidates.sort((a, b) => b.margin - a.margin);

  const result = new Map<string, { label: string; tip: string }>();
  for (const c of candidates) {
    if (!result.has(c.puuid)) {
      result.set(c.puuid, BADGE_DEFS[c.key]);
    }
  }
  return result;
}

function ItemSlot({ id }: { id: number }) {
  const items = useItems();
  const item = id !== 0 ? items.data?.get(id) : undefined;

  if (!item) {
    return <div className="size-5 rounded-sm bg-muted/40" />;
  }

  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <span className="inline-block cursor-default">
          <ItemIcon
            iconUrl={item.iconUrl}
            alt={item.name}
            className="size-5 rounded-sm"
          />
        </span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="pointer-events-none z-50 w-max max-w-72 rounded-md border bg-popover/85 p-3 text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:data-[side=bottom]:animate-in data-[state=delayed-open]:data-[side=top]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-start gap-3">
            <img
              src={item.iconUrl}
              alt=""
              aria-hidden="true"
              className="size-10 shrink-0 rounded-md bg-muted"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="text-sm font-semibold leading-tight">{item.name}</div>
              {item.priceTotal ? (
                <div className="font-mono text-xs text-amber-400">{item.priceTotal}g</div>
              ) : null}
            </div>
          </div>
          {item.description && (
            <div
              className="item-tooltip-body mt-2 text-xs leading-relaxed text-muted-foreground"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted Riot item data from CDragon
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function ItemSlots({ items }: { items: number[] }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      variants={itemsContainer}
      initial={reduced ? "show" : "hidden"}
      animate="show"
      className="flex gap-0.5"
    >
      {items.map((id, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: items array has fixed positions (slots 0-6)
        <m.div key={i} variants={itemReveal}>
          <ItemSlot id={id} />
        </m.div>
      ))}
    </m.div>
  );
}

function StatBar({
  Icon,
  label,
  value,
  max,
  fillClassName,
  labelClassName,
}: {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  max: number;
  fillClassName: string;
  labelClassName: string;
}) {
  const reduced = useReducedMotion();
  const target = max > 0 ? value / max : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex w-10 items-center gap-1 font-mono text-[10px] uppercase tracking-wider",
          labelClassName
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        <span>{label}</span>
      </span>
      <div className="relative h-1 w-20 overflow-hidden rounded-full bg-muted/40">
        <m.div
          className={cn("absolute inset-y-0 left-0 w-full rounded-full", fillClassName)}
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: reduced ? target : 0 }}
          animate={{ scaleX: target }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: "spring", stiffness: 220, damping: 28, delay: 0.18 }
          }
        />
      </div>
      <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {(value / 1000).toFixed(1)}k
      </span>
    </div>
  );
}

function ObjectivePip({
  Icon,
  count,
  iconClassName,
}: {
  Icon: ComponentType<{ className?: string }>;
  count: number;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 font-mono text-[10px] tabular-nums",
        count === 0 ? "opacity-25" : ""
      )}
    >
      <Icon className={cn("size-3", iconClassName)} />
      <span>{count}</span>
    </span>
  );
}

function TeamObjectiveStrip({ objectives }: { objectives: TeamSummary["objectives"] }) {
  return (
    <div className="flex items-center gap-2.5">
      <ObjectivePip
        Icon={TowerIcon}
        count={objectives.tower.kills}
        iconClassName="text-amber-400/80"
      />
      <ObjectivePip
        Icon={InhibitorIcon}
        count={objectives.inhibitor.kills}
        iconClassName="text-violet-400/80"
      />
      <ObjectivePip
        Icon={FireDrakeIcon}
        count={objectives.dragon.kills}
        iconClassName="text-emerald-400/80"
      />
      <ObjectivePip
        Icon={RiftHeraldIcon}
        count={objectives.riftHerald.kills}
        iconClassName="text-purple-400/80"
      />
      <ObjectivePip
        Icon={BaronNashorIcon}
        count={objectives.baron.kills}
        iconClassName="text-purple-300/80"
      />
    </div>
  );
}

// Soul drake = whichever team's 4th non-Elder dragon kill arrives first in the
// timeline. Element comes from that drake's type. Elder is excluded since it
// only spawns after a soul has already been claimed.
const SOUL_LABEL: Record<string, string> = {
  DRAGON_FIRE: "Infernal Soul",
  DRAGON_OCEAN: "Ocean Soul",
  DRAGON_MOUNTAIN: "Mountain Soul",
  DRAGON_CLOUD: "Cloud Soul",
  DRAGON_HEXTECH: "Hextech Soul",
  DRAGON_CHEMTECH: "Chemtech Soul",
};

const SOUL_COLORS: Record<string, { bg: string; text: string }> = {
  DRAGON_FIRE: { bg: "bg-orange-500/15", text: "text-orange-400" },
  DRAGON_OCEAN: { bg: "bg-cyan-500/15", text: "text-cyan-300" },
  DRAGON_MOUNTAIN: { bg: "bg-stone-500/20", text: "text-stone-300" },
  DRAGON_CLOUD: { bg: "bg-slate-400/15", text: "text-slate-200" },
  DRAGON_HEXTECH: { bg: "bg-violet-500/15", text: "text-violet-300" },
  DRAGON_CHEMTECH: { bg: "bg-emerald-500/15", text: "text-emerald-300" },
};

const SOUL_ICON: Record<string, ComponentType<{ className?: string }>> = {
  DRAGON_FIRE: FireDrakeIcon,
  DRAGON_OCEAN: OceanDrakeIcon,
  DRAGON_MOUNTAIN: MountainDrakeIcon,
  DRAGON_CLOUD: CloudDrakeIcon,
  DRAGON_HEXTECH: HextechDrakeIcon,
  DRAGON_CHEMTECH: ChemtechDrakeIcon,
};

function computeSoul(
  timeline: MatchTimelineProjection | undefined
): { teamId: number; type: string } | null {
  if (!timeline) return null;
  const dragons = timeline.objectives
    .filter((o) => o.type.startsWith("DRAGON_") && o.type !== "DRAGON_ELDER")
    .sort((a, b) => a.ts - b.ts);
  const counts = new Map<number, number>();
  for (const d of dragons) {
    const c = (counts.get(d.teamId) ?? 0) + 1;
    counts.set(d.teamId, c);
    if (c >= 4) return { teamId: d.teamId, type: d.type };
  }
  return null;
}

function SoulChip({ type }: { type: string }) {
  const Icon = SOUL_ICON[type];
  const colors = SOUL_COLORS[type];
  const label = SOUL_LABEL[type];
  if (!Icon || !colors || !label) return null;
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        colors.bg,
        colors.text
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function MatchHeaderStrip({
  matchId,
  teams,
}: {
  matchId: string;
  teams: TeamSummary[];
}) {
  const timeline = useMatchTimeline(matchId);
  const soul = computeSoul(timeline.data);
  const blue = teams.find((t) => t.teamId === 100);
  const red = teams.find((t) => t.teamId === 200);
  if (!blue || !red) return null;

  const fmtGold = (g: number) => `${(g / 1000).toFixed(1)}k`;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 rounded-md border bg-card/60 p-3 backdrop-blur-sm">
      {/* Blue side */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="text-lg font-bold tabular-nums text-blue-400">
              {blue.totalKills}
            </span>
            <KillsIcon className="size-4" />
          </span>
          <span className="flex items-center gap-1 text-amber-400/80">
            <GoldIcon className="size-3.5" />
            <span className="font-mono text-xs tabular-nums">
              {fmtGold(blue.totalGold)}
            </span>
          </span>
          {blue.objectives.champion.first && (
            <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
              First Blood
            </span>
          )}
          {blue.objectives.tower.first && (
            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
              First Tower
            </span>
          )}
          {soul && soul.teamId === blue.teamId && <SoulChip type={soul.type} />}
        </div>
        <TeamObjectiveStrip objectives={blue.objectives} />
      </div>

      {/* VS divider */}
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
        vs
      </span>

      {/* Red side */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {soul && soul.teamId === red.teamId && <SoulChip type={soul.type} />}
          {red.objectives.champion.first && (
            <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
              First Blood
            </span>
          )}
          {red.objectives.tower.first && (
            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
              First Tower
            </span>
          )}
          <span className="flex items-center gap-1 text-amber-400/80">
            <span className="font-mono text-xs tabular-nums">
              {fmtGold(red.totalGold)}
            </span>
            <GoldIcon className="size-3.5" />
          </span>
          <span className="flex items-center gap-1.5">
            <KillsIcon className="size-4" />
            <span className="text-lg font-bold tabular-nums text-red-400">
              {red.totalKills}
            </span>
          </span>
        </div>
        <div className="flex justify-end">
          <TeamObjectiveStrip objectives={red.objectives} />
        </div>
      </div>
    </div>
  );
}

function SegmentedDamageBar({
  physical,
  magic,
  trueDmg,
  max,
}: {
  physical: number;
  magic: number;
  trueDmg: number;
  max: number;
}) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPlaying(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = physical + magic + trueDmg;
  const physW = max > 0 ? physical / max : 0;
  const magicW = max > 0 ? magic / max : 0;
  const trueW = max > 0 ? trueDmg / max : 0;

  return (
    <TooltipPrimitive.Root delayDuration={150}>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex cursor-default items-center gap-1.5">
          <span className="flex w-10 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-red-400/80">
            <CrossedSwordsIcon className="size-3" aria-hidden="true" />
            <span>Dmg</span>
          </span>
          <div className="relative flex h-1 w-20 overflow-hidden rounded-full bg-muted/40">
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-red-500/90 to-orange-400/90"
              style={{ transformOrigin: "left", width: `${physW * 100}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.18 }
              }
            />
            <m.div
              className="h-full shrink-0 bg-gradient-to-r from-blue-500/90 to-violet-400/90"
              style={{ transformOrigin: "left", width: `${magicW * 100}%` }}
              animate={{ scaleX: playing || reduced ? 1 : 0 }}
              transition={
                !playing || reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 220, damping: 28, delay: 0.22 }
              }
            />
            {trueW > 0 && (
              <m.div
                className="h-full shrink-0 bg-white/55"
                style={{ transformOrigin: "left", width: `${trueW * 100}%` }}
                animate={{ scaleX: playing || reduced ? 1 : 0 }}
                transition={
                  !playing || reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 220, damping: 28, delay: 0.26 }
                }
              />
            )}
          </div>
          <span className="w-10 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {(total / 1000).toFixed(1)}k
          </span>
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="pointer-events-none z-50 rounded-md border bg-popover/85 p-2 text-popover-foreground shadow-xl backdrop-blur-md"
        >
          <div className="flex flex-col gap-0.5 font-mono text-[10px] tabular-nums">
            <div className="flex items-center gap-2">
              <span className="w-10 text-orange-400">Phys</span>
              <span>{(physical / 1000).toFixed(1)}k</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 text-violet-400">Magic</span>
              <span>{(magic / 1000).toFixed(1)}k</span>
            </div>
            {trueDmg > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-10 text-white/70">True</span>
                <span>{(trueDmg / 1000).toFixed(1)}k</span>
              </div>
            )}
          </div>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function ParticipantRow({
  p,
  isMe,
  maxDamage,
  maxGold,
  badge,
}: {
  p: ParticipantDetail;
  isMe?: boolean;
  maxDamage: number;
  maxGold: number;
  badge?: { label: string; tip: string };
}) {
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
      <div className="relative shrink-0">
        <ChampionSquareIcon
          championName={p.championName}
          alt={displayName}
          className="size-9 rounded-md"
        />
        <span className="absolute -bottom-0.5 -right-0.5 min-w-[14px] rounded border border-border/60 bg-background/90 px-0.5 text-center font-mono text-[9px] leading-[14px] tabular-nums text-muted-foreground">
          {p.championLevel}
        </span>
      </div>
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
                  className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2.5 py-1.5 text-xs text-popover-foreground shadow-md backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
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
                {p.csTotal}
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={5}
                className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2.5 py-1.5 text-xs text-popover-foreground shadow-md backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
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
                className="pointer-events-none z-50 rounded-md border bg-popover/85 px-2.5 py-1.5 text-xs text-popover-foreground shadow-md backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                Vision score — wards placed, wards killed, and time providing vision
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <ItemSlots items={p.items} />
        <div className="flex flex-col gap-0.5">
          <SegmentedDamageBar
            physical={p.damageDealtPhysical}
            magic={p.damageDealtMagic}
            trueDmg={p.damageDealtTrue}
            max={maxDamage}
          />
          <StatBar
            Icon={GoldIcon}
            label="Gld"
            value={p.goldEarned}
            max={maxGold}
            fillClassName="bg-gradient-to-r from-amber-500/80 to-yellow-300/80"
            labelClassName="text-amber-400/80"
          />
        </div>
      </div>
    </m.li>
  );
}

function TeamBlock({
  title,
  participants,
  myPuuid,
  maxDamage,
  maxGold,
  badges,
  goldLead,
}: {
  title: string;
  participants: ParticipantDetail[];
  myPuuid?: string;
  maxDamage: number;
  maxGold: number;
  badges: Map<string, { label: string; tip: string }>;
  goldLead: number;
}) {
  const win = participants[0]?.win ?? false;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-medium">
        <span>{title}</span>
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            win ? "text-emerald-400" : "text-red-400"
          )}
        >
          {win ? "Win" : "Loss"}
        </span>
        {goldLead !== 0 && (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              goldLead > 0 ? "text-amber-400/70" : "text-muted-foreground/50"
            )}
          >
            {goldLead > 0 ? "+" : ""}
            {(goldLead / 1000).toFixed(1)}k gold
          </span>
        )}
      </h3>
      <m.ul
        initial="hidden"
        animate="show"
        variants={teamContainer}
        className="flex flex-col gap-2"
      >
        {participants.map((p) => (
          <ParticipantRow
            key={p.puuid}
            p={p}
            isMe={p.puuid === myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
            badge={badges.get(p.puuid)}
          />
        ))}
      </m.ul>
    </section>
  );
}

export function MatchDetailView({
  detail,
  currentChampion,
  myPuuid,
}: {
  detail: MatchDetail;
  currentChampion?: string;
  myPuuid?: string;
}) {
  const reduced = useReducedMotion();
  const blue = detail.participants.filter((p) => p.teamId === 100);
  const red = detail.participants.filter((p) => p.teamId === 200);
  const maxDamage = Math.max(...detail.participants.map((p) => p.totalDamage), 1);
  const maxGold = Math.max(...detail.participants.map((p) => p.goldEarned), 1);
  const badges = computeBadges(detail.participants);
  const blueGold = detail.teams.find((t) => t.teamId === 100)?.totalGold ?? 0;
  const redGold = detail.teams.find((t) => t.teamId === 200)?.totalGold ?? 0;

  useSplashChampion(currentChampion);

  return (
    <div className="flex flex-col gap-6">
      <MatchHeaderStrip matchId={detail.matchId} teams={detail.teams} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <TeamBlock
            title="Blue side"
            participants={blue}
            myPuuid={myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
            badges={badges}
            goldLead={blueGold - redGold}
          />
        </m.div>
        <m.div
          initial={reduced ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.12 }}
        >
          <TeamBlock
            title="Red side"
            participants={red}
            myPuuid={myPuuid}
            maxDamage={maxDamage}
            maxGold={maxGold}
            badges={badges}
            goldLead={redGold - blueGold}
          />
        </m.div>
      </div>
      <MatchBuildOrder detail={detail} myPuuid={myPuuid} />
      <MatchGoldLead detail={detail} myPuuid={myPuuid} />
      <MatchEventTimelines detail={detail} myPuuid={myPuuid} />
      <MatchKillMap detail={detail} myPuuid={myPuuid} />
      <MatchSkillOrder detail={detail} myPuuid={myPuuid} />
      <MatchLanePhase detail={detail} myPuuid={myPuuid} />
    </div>
  );
}
