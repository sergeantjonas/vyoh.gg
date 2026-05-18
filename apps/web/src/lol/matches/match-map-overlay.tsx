import {
  BaronNashorIcon,
  ChemtechDrakeIcon,
  CloudDrakeIcon,
  ElderDragonIcon,
  FireDrakeIcon,
  HextechDrakeIcon,
  InhibitorIcon,
  KillsIcon,
  MountainDrakeIcon,
  OceanDrakeIcon,
  RiftHeraldIcon,
  TowerIcon,
  VoidGrubIcon,
} from "@/components/game-icons";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useChampionName } from "@/lol/champions/use-champions";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { formatGameTime } from "@vyoh/shared";
import type { ParticipantDetail } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Area,
  AreaChart,
  Brush,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const MINIMAP_URL =
  "https://wsrv.nl/?url=raw.communitydragon.org/latest/game/assets/maps/info/map11/2dlevelminimap_npe_1.png&w=720&output=webp";

type EventKind =
  | "kill"
  | "tower"
  | "inhibitor"
  | "dragon"
  | "herald"
  | "baron"
  | "voidgrubs";

interface UnifiedEvent {
  id: string;
  kind: EventKind;
  ts: number;
  position: { x: number; y: number } | null;
  teamId: number;
  // Kill-only metadata
  killerId?: number;
  victimId?: number;
  assistIds?: number[];
  // Objective-only metadata
  objectiveType?: string;
}

interface FilterState {
  kills: boolean;
  towers: boolean;
  inhibitors: boolean;
  dragons: boolean;
  heralds: boolean;
  barons: boolean;
  voidgrubs: boolean;
  yourKillsOnly: boolean;
  yourDeathsOnly: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  kills: true,
  towers: true,
  inhibitors: true,
  dragons: true,
  heralds: true,
  barons: true,
  voidgrubs: true,
  yourKillsOnly: false,
  yourDeathsOnly: false,
};

const OBJECTIVE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  DRAGON_FIRE: FireDrakeIcon,
  DRAGON_OCEAN: OceanDrakeIcon,
  DRAGON_MOUNTAIN: MountainDrakeIcon,
  DRAGON_CLOUD: CloudDrakeIcon,
  DRAGON_HEXTECH: HextechDrakeIcon,
  DRAGON_CHEMTECH: ChemtechDrakeIcon,
  DRAGON_ELDER: ElderDragonIcon,
  BARON_NASHOR: BaronNashorIcon,
  RIFT_HERALD: RiftHeraldIcon,
  HORDE: VoidGrubIcon,
  TOWER: TowerIcon,
  INHIBITOR: InhibitorIcon,
};

function classifyObjective(type: string): EventKind {
  if (type === "TOWER") return "tower";
  if (type === "INHIBITOR") return "inhibitor";
  if (type === "BARON_NASHOR") return "baron";
  if (type === "RIFT_HERALD") return "herald";
  if (type === "HORDE") return "voidgrubs";
  return "dragon";
}

function objectiveLabel(type: string): string {
  switch (type) {
    case "DRAGON_FIRE":
      return "Fire Drake";
    case "DRAGON_OCEAN":
      return "Ocean Drake";
    case "DRAGON_MOUNTAIN":
      return "Mountain Drake";
    case "DRAGON_CLOUD":
      return "Cloud Drake";
    case "DRAGON_HEXTECH":
      return "Hextech Drake";
    case "DRAGON_CHEMTECH":
      return "Chemtech Drake";
    case "DRAGON_ELDER":
      return "Elder Dragon";
    case "BARON_NASHOR":
      return "Baron Nashor";
    case "RIFT_HERALD":
      return "Rift Herald";
    case "HORDE":
      return "Void Grubs";
    case "INHIBITOR":
      return "Inhibitor";
    case "TOWER":
      return "Tower";
    default:
      return type.replace(/_/g, " ");
  }
}

// ---- Gold-lead chart with internal brush ----

const BLUE_IDS = [1, 2, 3, 4, 5] as const;
const RED_IDS = [6, 7, 8, 9, 10] as const;

interface GoldPoint {
  minute: number;
  lead: number;
}

interface BrushTravellerProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// Tall pill-shape grip handle with a vertical seam for affordance.
function BrushTraveller(props: BrushTravellerProps) {
  const x = props.x ?? 0;
  const y = props.y ?? 0;
  const w = props.width ?? 10;
  const h = props.height ?? 22;
  return (
    <g style={{ cursor: "ew-resize" }}>
      <rect
        x={x}
        y={y - 2}
        width={w}
        height={h + 4}
        fill="var(--foreground)"
        fillOpacity={0.7}
        rx={2}
      />
      <line
        x1={x + w / 2}
        y1={y + 4}
        x2={x + w / 2}
        y2={y + h - 2}
        stroke="var(--background)"
        strokeOpacity={0.6}
        strokeWidth={1}
      />
    </g>
  );
}

function GoldLeadBrush({
  data,
  startMin,
  endMin,
  onChange,
}: {
  data: GoldPoint[];
  startMin: number;
  endMin: number;
  onChange: (start: number, end: number) => void;
}) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.lead)), 1000);

  const startIndex = Math.max(
    0,
    data.findIndex((d) => d.minute >= startMin)
  );
  const lastByMinute = [...data].reverse().find((d) => d.minute <= endMin);
  const endIndex = lastByMinute ? data.indexOf(lastByMinute) : data.length - 1;

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="mmo-gl-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="50%" stopColor="#34d399" stopOpacity={0.25} />
              <stop offset="50%" stopColor="#fb7185" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="mmo-gl-stroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="50%" stopColor="#34d399" stopOpacity={1} />
              <stop offset="50%" stopColor="#fb7185" stopOpacity={1} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="minute"
            tickFormatter={(v: number) => `${v}m`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            height={0}
          />
          <YAxis hide domain={[-maxAbs, maxAbs]} />
          <ReferenceLine
            y={0}
            stroke="var(--foreground)"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
          <Area
            type="monotone"
            dataKey="lead"
            fill="url(#mmo-gl-fill)"
            stroke="url(#mmo-gl-stroke)"
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          />
          <Brush
            dataKey="minute"
            height={22}
            stroke="var(--border)"
            fill="var(--muted)"
            fillOpacity={0.35}
            travellerWidth={10}
            traveller={<BrushTraveller />}
            startIndex={startIndex}
            endIndex={endIndex}
            tickFormatter={(v: number) => `${v}m`}
            onChange={(range: { startIndex?: number; endIndex?: number }) => {
              const s = range.startIndex ?? 0;
              const e = range.endIndex ?? data.length - 1;
              const sMin = data[s]?.minute ?? 0;
              const eMin = data[e]?.minute ?? data[data.length - 1]?.minute ?? 0;
              onChange(sMin, eMin);
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Map panel ----

function MapDot({
  event,
  isSelected,
  isMyEvent,
  isMyDeath,
  dim,
  onClick,
  reduced,
  staggerDelay,
}: {
  event: UnifiedEvent;
  isSelected: boolean;
  isMyEvent: boolean;
  isMyDeath: boolean;
  dim: boolean;
  onClick: () => void;
  reduced: boolean;
  staggerDelay: number;
}) {
  if (!event.position) return null;
  const isBlue = event.teamId === 100;
  const baseFill = isBlue ? "#60a5fa" : "#f87171";

  if (event.kind === "kill") {
    const r = isMyEvent ? 240 : isMyDeath ? 200 : 160;
    const fill = isMyDeath ? "white" : baseFill;
    const opacity = dim ? 0.18 : isMyEvent ? 0.95 : isMyDeath ? 0.7 : 0.8;
    return (
      <m.circle
        cx={event.position.x}
        cy={15000 - event.position.y}
        r={isSelected ? r * 1.55 : r}
        fill={fill}
        stroke={isSelected ? "white" : "none"}
        strokeWidth={isSelected ? 90 : 0}
        initial={reduced ? { opacity, scale: 1 } : { opacity: 0, scale: 0 }}
        animate={{ opacity, scale: 1 }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 320,
                damping: 22,
                delay: staggerDelay,
              }
        }
        onClick={onClick}
        style={{ cursor: "pointer" }}
      />
    );
  }

  // Objective / building — square for buildings, ringed circle for monsters
  const isBuilding = event.kind === "tower" || event.kind === "inhibitor";
  const size = isBuilding ? 320 : 380;
  const opacity = dim ? 0.25 : 0.9;
  if (isBuilding) {
    return (
      <m.rect
        x={event.position.x - size / 2}
        y={15000 - event.position.y - size / 2}
        width={isSelected ? size * 1.3 : size}
        height={isSelected ? size * 1.3 : size}
        fill={baseFill}
        stroke={isSelected ? "white" : "rgba(0,0,0,0.4)"}
        strokeWidth={isSelected ? 60 : 30}
        rx={40}
        initial={reduced ? { opacity, scale: 1 } : { opacity: 0, scale: 0 }}
        animate={{ opacity, scale: 1 }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                type: "spring",
                stiffness: 320,
                damping: 22,
                delay: staggerDelay,
              }
        }
        onClick={onClick}
        style={{ cursor: "pointer", transformOrigin: "center" }}
      />
    );
  }
  return (
    <m.circle
      cx={event.position.x}
      cy={15000 - event.position.y}
      r={isSelected ? size * 0.7 : size / 2}
      fill={baseFill}
      stroke={isSelected ? "white" : "rgba(255,255,255,0.45)"}
      strokeWidth={isSelected ? 60 : 30}
      initial={reduced ? { opacity, scale: 1 } : { opacity: 0, scale: 0 }}
      animate={{ opacity, scale: 1 }}
      transition={
        reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22 }
      }
      onClick={onClick}
      style={{ cursor: "pointer" }}
    />
  );
}

// ---- Feed entry ----

function FeedRow({
  event,
  championByPid,
  isSelected,
  isMyEvent,
  isMyDeath,
  dim,
  onClick,
  feedRef,
}: {
  event: UnifiedEvent;
  championByPid: Map<number, string>;
  isSelected: boolean;
  isMyEvent: boolean;
  isMyDeath: boolean;
  dim: boolean;
  onClick: () => void;
  feedRef: (el: HTMLLIElement | null) => void;
}) {
  const teamColor =
    event.teamId === 100
      ? "text-blue-300 border-blue-400/30"
      : "text-red-300 border-red-400/30";

  let inner: ReactNode;

  if (event.kind === "kill") {
    const killerName =
      event.killerId !== undefined
        ? (championByPid.get(event.killerId) ?? `P${event.killerId}`)
        : "Unknown";
    const victimName =
      event.victimId !== undefined
        ? (championByPid.get(event.victimId) ?? `P${event.victimId}`)
        : "Unknown";
    const assistNames = (event.assistIds ?? [])
      .map((id) => championByPid.get(id) ?? `P${id}`)
      .filter(Boolean);
    inner = (
      <span className="flex items-baseline gap-1 truncate">
        <KillsIcon className="size-3 shrink-0 self-center text-muted-foreground" />
        <span
          className={cn(
            "font-medium",
            isMyEvent && "text-foreground",
            isMyDeath && "text-foreground"
          )}
        >
          {killerName}
        </span>
        <span className="text-muted-foreground/60">killed</span>
        <span className={cn(isMyDeath ? "text-foreground" : "font-medium")}>
          {victimName}
        </span>
        {assistNames.length > 0 && (
          <span className="truncate text-muted-foreground/60">
            ({assistNames.join(", ")})
          </span>
        )}
      </span>
    );
  } else {
    const objType = event.objectiveType ?? "";
    const Icon = OBJECTIVE_ICONS[objType];
    const teamName = event.teamId === 100 ? "Blue" : "Red";
    inner = (
      <span className="flex items-baseline gap-1.5 truncate">
        {Icon && <Icon className="size-3.5 shrink-0 self-center" />}
        <span className="font-medium">{objectiveLabel(objType)}</span>
        <span className="text-muted-foreground/60">— {teamName}</span>
      </span>
    );
  }

  return (
    <li ref={feedRef} className={cn(dim && "opacity-30")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition-colors",
          teamColor,
          isSelected
            ? "border-foreground/40 bg-foreground/[0.05]"
            : "border-transparent hover:bg-foreground/[0.03]"
        )}
      >
        <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {formatGameTime(event.ts)}
        </span>
        {inner}
      </button>
    </li>
  );
}

// ---- Filter chip ----

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
        active
          ? "border-foreground/30 bg-foreground/10 text-foreground"
          : "border-transparent bg-muted/30 text-muted-foreground/70 hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );
}

// ---- Main modal ----

interface MatchMapOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: {
    matchId: string;
    durationSec: number;
    participants: ParticipantDetail[];
  };
  myPuuid?: string | undefined;
}

export default function MatchMapOverlay({
  open,
  onOpenChange,
  detail,
  myPuuid,
}: MatchMapOverlayProps) {
  const timeline = useMatchTimeline(detail.matchId);
  const championName = useChampionName();
  const reduced = useReducedMotion();
  const totalMin = Math.ceil(detail.durationSec / 60);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brushStartMin, setBrushStartMin] = useState(0);
  const [brushEndMin, setBrushEndMin] = useState(totalMin);
  const feedRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Reset state each time modal opens
  useEffect(() => {
    if (open) {
      setFilters(DEFAULT_FILTERS);
      setSelectedId(null);
      setBrushStartMin(0);
      setBrushEndMin(totalMin);
    }
  }, [open, totalMin]);

  const myParticipantId = timeline.data?.participants.find(
    (p) => p.puuid === myPuuid
  )?.participantId;

  // Store the *display* name (e.g. "Wukong", "Jarvan IV") rather than the raw
  // Match-V5 alias ("MonkeyKing", "JarvanIV") so consumers can render directly.
  const championByPid = useMemo(() => {
    const map = new Map<number, string>();
    if (!timeline.data) return map;
    for (const tp of timeline.data.participants) {
      const dp = detail.participants.find((p) => p.puuid === tp.puuid);
      if (dp) map.set(tp.participantId, championName(dp.championName));
    }
    return map;
  }, [timeline.data, detail.participants, championName]);

  const events = useMemo<UnifiedEvent[]>(() => {
    if (!timeline.data) return [];
    const list: UnifiedEvent[] = [];
    for (let i = 0; i < timeline.data.kills.length; i++) {
      const k = timeline.data.kills[i];
      if (!k) continue;
      list.push({
        id: `kill:${i}`,
        kind: "kill",
        ts: k.ts,
        position: k.position,
        teamId: k.killerId <= 5 ? 100 : 200,
        killerId: k.killerId,
        victimId: k.victimId,
        assistIds: k.assistIds,
      });
    }
    for (let i = 0; i < timeline.data.objectives.length; i++) {
      const o = timeline.data.objectives[i];
      if (!o) continue;
      list.push({
        id: `obj:${i}`,
        kind: classifyObjective(o.type),
        ts: o.ts,
        position: o.position,
        teamId: o.teamId,
        objectiveType: o.type,
      });
    }
    list.sort((a, b) => a.ts - b.ts);
    return list;
  }, [timeline.data]);

  const goldData = useMemo<GoldPoint[]>(() => {
    if (!timeline.data || myParticipantId === undefined) return [];
    const myTeamId = myParticipantId <= 5 ? 100 : 200;
    return timeline.data.frames.map((frame) => {
      const blue = BLUE_IDS.reduce(
        (sum, id) => sum + (frame.perParticipant[id]?.gold ?? 0),
        0
      );
      const red = RED_IDS.reduce(
        (sum, id) => sum + (frame.perParticipant[id]?.gold ?? 0),
        0
      );
      const myGold = myTeamId === 100 ? blue : red;
      const theirGold = myTeamId === 100 ? red : blue;
      return { minute: Math.round(frame.ts / 60_000), lead: myGold - theirGold };
    });
  }, [timeline.data, myParticipantId]);

  const passesFilter = useCallback(
    (event: UnifiedEvent): boolean => {
      if (event.kind === "kill") {
        if (!filters.kills) return false;
        if (filters.yourKillsOnly && event.killerId !== myParticipantId) return false;
        if (filters.yourDeathsOnly && event.victimId !== myParticipantId) return false;
      } else {
        // Filtering objectives never excludes by yourKills/yourDeaths
        if (filters.yourKillsOnly || filters.yourDeathsOnly) return false;
        if (event.kind === "tower" && !filters.towers) return false;
        if (event.kind === "inhibitor" && !filters.inhibitors) return false;
        if (event.kind === "dragon" && !filters.dragons) return false;
        if (event.kind === "herald" && !filters.heralds) return false;
        if (event.kind === "baron" && !filters.barons) return false;
        if (event.kind === "voidgrubs" && !filters.voidgrubs) return false;
      }
      return true;
    },
    [filters, myParticipantId]
  );

  const visibleEvents = useMemo(
    () => events.filter(passesFilter),
    [events, passesFilter]
  );

  const isInWindow = useCallback(
    (ts: number) => {
      const minute = ts / 60_000;
      return minute >= brushStartMin && minute <= brushEndMin;
    },
    [brushStartMin, brushEndMin]
  );

  const toggleSelection = useCallback((eventId: string) => {
    setSelectedId((prev) => (prev === eventId ? null : eventId));
  }, []);

  // When selection changes from a map click, scroll feed entry into view
  useEffect(() => {
    if (!selectedId) return;
    const el = feedRefs.current.get(selectedId);
    if (el) {
      el.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
    }
  }, [selectedId, reduced]);

  const toggle = (key: keyof FilterState) =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 max-w-none w-screen h-dvh translate-x-0 translate-y-0 rounded-none p-4 md:p-6 flex flex-col gap-4 grid-cols-none">
        <DialogTitle className="sr-only">Match map overlay</DialogTitle>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-1.5 pr-12">
          <FilterChip active={filters.kills} onClick={() => toggle("kills")}>
            Kills
          </FilterChip>
          <FilterChip active={filters.towers} onClick={() => toggle("towers")}>
            Towers
          </FilterChip>
          <FilterChip active={filters.inhibitors} onClick={() => toggle("inhibitors")}>
            Inhibitors
          </FilterChip>
          <FilterChip active={filters.dragons} onClick={() => toggle("dragons")}>
            Dragons
          </FilterChip>
          <FilterChip active={filters.heralds} onClick={() => toggle("heralds")}>
            Heralds
          </FilterChip>
          <FilterChip active={filters.barons} onClick={() => toggle("barons")}>
            Barons
          </FilterChip>
          <FilterChip active={filters.voidgrubs} onClick={() => toggle("voidgrubs")}>
            Void Grubs
          </FilterChip>
          {myParticipantId !== undefined && (
            <>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              <FilterChip
                active={filters.yourKillsOnly}
                onClick={() => {
                  setFilters((f) => ({
                    ...f,
                    yourKillsOnly: !f.yourKillsOnly,
                    yourDeathsOnly: false,
                  }));
                }}
              >
                Your kills
              </FilterChip>
              <FilterChip
                active={filters.yourDeathsOnly}
                onClick={() => {
                  setFilters((f) => ({
                    ...f,
                    yourDeathsOnly: !f.yourDeathsOnly,
                    yourKillsOnly: false,
                  }));
                }}
              >
                Your deaths
              </FilterChip>
            </>
          )}
        </div>

        {/* Map + Feed */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[3fr_2fr]">
          {/* Map panel */}
          <TooltipPrimitive.Provider delayDuration={120}>
            <div className="relative min-h-0 overflow-hidden rounded-md border bg-card/60">
              {/* Both image and SVG use letterboxing (object-contain / xMidYMid meet)
                  so the dot coordinate space stays aligned with the map background
                  when the container is non-square. */}
              <img
                src={MINIMAP_URL}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-contain opacity-60"
              />
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 15000 15000"
                role="img"
                aria-label="Match event map"
                preserveAspectRatio="xMidYMid meet"
              >
                {visibleEvents.map((event, i) => (
                  <MapDot
                    key={event.id}
                    event={event}
                    isSelected={selectedId === event.id}
                    isMyEvent={
                      event.kind === "kill" && event.killerId === myParticipantId
                    }
                    isMyDeath={
                      event.kind === "kill" && event.victimId === myParticipantId
                    }
                    dim={
                      !isInWindow(event.ts) ||
                      (selectedId !== null && selectedId !== event.id)
                    }
                    onClick={() => toggleSelection(event.id)}
                    reduced={reduced ?? false}
                    staggerDelay={0.18 + (i / Math.max(visibleEvents.length, 1)) * 0.6}
                  />
                ))}
              </svg>
            </div>
          </TooltipPrimitive.Provider>

          {/* Feed panel */}
          <div className="flex min-h-0 flex-col rounded-md border bg-card/60">
            <div className="border-b px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Events · {visibleEvents.length}
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
              {visibleEvents.length === 0 ? (
                <li className="py-4 text-center text-xs text-muted-foreground">
                  No events match the active filters.
                </li>
              ) : (
                visibleEvents.map((event) => (
                  <FeedRow
                    key={event.id}
                    event={event}
                    championByPid={championByPid}
                    isSelected={selectedId === event.id}
                    isMyEvent={
                      event.kind === "kill" && event.killerId === myParticipantId
                    }
                    isMyDeath={
                      event.kind === "kill" && event.victimId === myParticipantId
                    }
                    dim={!isInWindow(event.ts)}
                    onClick={() => toggleSelection(event.id)}
                    feedRef={(el) => {
                      if (el) feedRefs.current.set(event.id, el);
                      else feedRefs.current.delete(event.id);
                    }}
                  />
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Gold-lead brush at bottom */}
        {goldData.length > 0 && (
          <div className="shrink-0">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70">
              <span>Gold lead · drag to filter time window</span>
              <span className="font-mono tabular-nums">
                {brushStartMin}m – {brushEndMin}m
              </span>
            </div>
            <GoldLeadBrush
              data={goldData}
              startMin={brushStartMin}
              endMin={brushEndMin}
              onChange={(s, e) => {
                setBrushStartMin(s);
                setBrushEndMin(e);
              }}
            />
          </div>
        )}
      </DialogContent>
    </DialogPrimitive.Root>
  );
}
