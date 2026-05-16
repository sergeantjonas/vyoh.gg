import { EmptyLiveGameIllustration, EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { KeystoneIcon } from "@/lol/_shared/assets/keystone-icon";
import { SummonerSpellIcon } from "@/lol/_shared/assets/summoner-spell-icon";
import { useLiveGame } from "@/lol/matches/use-live-match";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useQueries } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { LiveGameParticipant, LiveMatch, LolAccount } from "@vyoh/shared";
import { useEffect, useRef, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/lol/$accountSlug/live")({
  component: LivePage,
});

// ─── static look-up tables ───────────────────────────────────────────────────

const QUEUE_NAMES: Record<number, string> = {
  0: "Custom",
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  490: "Quickplay",
  700: "Clash",
  720: "ARAM Clash",
  830: "Co-op vs AI",
  840: "Co-op vs AI",
  850: "Co-op vs AI",
  900: "URF",
  1020: "One for All",
  1300: "Nexus Blitz",
  1400: "Ultimate Spellbook",
  1700: "Arena",
  1900: "URF",
};

const MAP_NAMES: Record<number, string> = {
  11: "Summoner's Rift",
  12: "Howling Abyss",
  21: "Nexus Blitz",
  30: "Rings of Wrath",
};

// ─── composition analysis ────────────────────────────────────────────────────

const COMP_AXES = ["tank", "fighter", "mage", "assassin", "marksman", "support"] as const;
type CompAxis = (typeof COMP_AXES)[number];

interface ChampionInfo {
  name: string;
  roles: string[];
}

async function fetchChampionInfo(championId: number): Promise<ChampionInfo | null> {
  const url = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/${championId}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as ChampionInfo;
  } catch {
    return null;
  }
}

function computeTeamComp(
  ids: number[],
  rolesByChampion: Record<number, string[]>
): Record<CompAxis, number> {
  const counts = Object.fromEntries(COMP_AXES.map((a) => [a, 0])) as Record<
    CompAxis,
    number
  >;
  for (const id of ids) {
    for (const role of rolesByChampion[id] ?? []) {
      if ((COMP_AXES as readonly string[]).includes(role)) {
        counts[role as CompAxis]++;
      }
    }
  }
  for (const axis of COMP_AXES) {
    counts[axis] = Math.round((counts[axis] / Math.max(ids.length, 1)) * 100);
  }
  return counts;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function queueLabel(queueId: number): string {
  return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
}

function mapLabel(mapId: number): string {
  return MAP_NAMES[mapId] ?? `Map ${mapId}`;
}

function championPrimaryUrl(championId: number, width: number): string {
  const src = `cdn.communitydragon.org/latest/champion/${championId}/square`;
  return `https://wsrv.nl/?url=${src}&w=${width}&output=webp&q=85`;
}

function championFallbackUrl(championId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png`;
}

function isUserParticipant(
  p: LiveGameParticipant,
  account: LolAccount | undefined
): boolean {
  if (!account) return false;
  return (
    p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
    p.riotIdTagLine.toLowerCase() === account.tagLine.toLowerCase()
  );
}

// Spectator-V5 doesn't expose teamPosition, so we infer lane from Smite,
// summoner spells, and champion role tags. The five slots are filled by
// optimal assignment over a cost matrix (brute-forced over 5! = 120
// permutations) rather than per-participant classification, so two champs
// that both look "mid" can't both end up there — the algorithm pins each
// lane to exactly one player. Pairs whose swap barely changes total cost
// are surfaced as `uncertain` in the UI.
const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Lane = (typeof LANE_ORDER)[number];

const SMITE_SPELL_ID = 11;
const SPELL_CLEANSE = 1;
const SPELL_EXHAUST = 3;
const SPELL_GHOST = 6;
const SPELL_HEAL = 7;
const SPELL_TELEPORT = 12;
const SPELL_IGNITE = 14;
const SPELL_BARRIER = 21;

// "How surprising is it to see this role play this lane?" 0 = canonical,
// higher = more off-meta. Each champion takes the min across its role tags,
// so a fighter/assassin scores low on both TOP and MID.
const ROLE_LANE_COSTS: Record<string, Partial<Record<Lane, number>>> = {
  marksman: { BOTTOM: 0, SUPPORT: 2, MID: 3, TOP: 4, JUNGLE: 4 },
  support: { SUPPORT: 0, MID: 3, BOTTOM: 3, TOP: 3, JUNGLE: 4 },
  tank: { TOP: 1, SUPPORT: 1, JUNGLE: 2, MID: 3, BOTTOM: 4 },
  fighter: { TOP: 1, JUNGLE: 1, MID: 3, BOTTOM: 3, SUPPORT: 3 },
  assassin: { MID: 1, JUNGLE: 2, TOP: 3, BOTTOM: 3, SUPPORT: 4 },
  mage: { MID: 1, SUPPORT: 2, TOP: 2, JUNGLE: 3, BOTTOM: 4 },
};

// Additive nudges from summoner spells. Small magnitudes so they only break
// ties, never override strong role signals.
const SPELL_LANE_BIAS: Record<number, Partial<Record<Lane, number>>> = {
  [SPELL_TELEPORT]: { TOP: -1.5, MID: -0.5 },
  [SPELL_HEAL]: { BOTTOM: -2 },
  [SPELL_IGNITE]: { MID: -1, TOP: -0.5 },
  [SPELL_EXHAUST]: { SUPPORT: -1, MID: -0.5 },
  [SPELL_CLEANSE]: { MID: -0.5, BOTTOM: -0.5 },
  [SPELL_BARRIER]: { MID: -0.5 },
  [SPELL_GHOST]: { TOP: -0.5 },
};

function laneCostsFor(p: LiveGameParticipant, roles: string[]): Record<Lane, number> {
  const costs: Record<Lane, number> = {
    TOP: 5,
    JUNGLE: 5,
    MID: 5,
    BOTTOM: 5,
    SUPPORT: 5,
  };
  for (const role of roles) {
    const rc = ROLE_LANE_COSTS[role];
    if (!rc) continue;
    for (const lane of LANE_ORDER) {
      const c = rc[lane];
      if (c !== undefined && c < costs[lane]) costs[lane] = c;
    }
  }
  // Smite locks JUNGLE hard but not absolutely — leaves room for the rare
  // off-meta smite-top read if the algorithm finds a better global fit.
  const hasSmite = p.spell1Id === SMITE_SPELL_ID || p.spell2Id === SMITE_SPELL_ID;
  if (hasSmite) {
    costs.JUNGLE = 0;
    for (const lane of LANE_ORDER) {
      if (lane !== "JUNGLE") costs[lane] += 5;
    }
  } else {
    costs.JUNGLE += 5;
  }
  for (const spellId of [p.spell1Id, p.spell2Id]) {
    const bias = SPELL_LANE_BIAS[spellId];
    if (!bias) continue;
    for (const lane of LANE_ORDER) {
      const b = bias[lane];
      if (b !== undefined) costs[lane] += b;
    }
  }
  return costs;
}

function* permutations(n: number): Generator<number[]> {
  const used = new Array(n).fill(false);
  const current: number[] = [];
  function* rec(): Generator<number[]> {
    if (current.length === n) {
      yield [...current];
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      current.push(i);
      yield* rec();
      current.pop();
      used[i] = false;
    }
  }
  yield* rec();
}

interface LaneAssignment {
  participant: LiveGameParticipant;
  lane: Lane | null;
  uncertain: boolean;
}

// Two participants are "uncertain" when swapping their assigned lanes raises
// the total cost by less than this — i.e., the algorithm has near-equal
// evidence for both orderings. Tuned against typical summoner-spell deltas
// (±0.5–2.0) so flex-vs-flex pairs surface but clear assignments don't.
const UNCERTAINTY_THRESHOLD = 1.0;

function assignLanes(
  team: LiveGameParticipant[],
  rolesByChampion: Record<number, string[]>
): LaneAssignment[] {
  if (team.length !== 5) {
    return team.map((p) => ({ participant: p, lane: null, uncertain: false }));
  }
  const costs = team.map((p) => laneCostsFor(p, rolesByChampion[p.championId] ?? []));
  let bestTotal = Number.POSITIVE_INFINITY;
  let bestLanes: Lane[] = [...LANE_ORDER];
  for (const perm of permutations(5)) {
    let total = 0;
    for (let i = 0; i < 5; i++) {
      const c = costs[i];
      const laneIdx = perm[i];
      const lane = laneIdx === undefined ? undefined : LANE_ORDER[laneIdx];
      if (c && lane) total += c[lane];
    }
    if (total < bestTotal) {
      bestTotal = total;
      bestLanes = perm.map((idx) => LANE_ORDER[idx] as Lane);
    }
  }
  const uncertain = new Set<number>();
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      const ci = costs[i];
      const cj = costs[j];
      const li = bestLanes[i];
      const lj = bestLanes[j];
      if (!ci || !cj || !li || !lj) continue;
      const swapDelta = ci[lj] + cj[li] - ci[li] - cj[lj];
      if (swapDelta < UNCERTAINTY_THRESHOLD) {
        uncertain.add(i);
        uncertain.add(j);
      }
    }
  }
  return team
    .map((p, i) => ({
      participant: p,
      lane: bestLanes[i] ?? null,
      uncertain: uncertain.has(i),
    }))
    .sort((a, b) => {
      const ai = a.lane ? LANE_ORDER.indexOf(a.lane) : -1;
      const bi = b.lane ? LANE_ORDER.indexOf(b.lane) : -1;
      return ai - bi;
    });
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── hooks ───────────────────────────────────────────────────────────────────

function useGameTimer(match: LiveMatch | null | undefined): string {
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!match) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [match]);

  if (!match) return "—";
  const elapsed = match.gameLength + (Date.now() - match.polledAt) / 1000;
  void tick;
  return formatSeconds(Math.max(0, elapsed));
}

// ─── small display components ─────────────────────────────────────────────────

function ChampionImg({
  championId,
  width = 48,
  className,
}: {
  championId: number;
  width?: number;
  className?: string;
}) {
  return (
    <img
      src={championPrimaryUrl(championId, width)}
      alt=""
      className={className}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = championFallbackUrl(championId);
      }}
    />
  );
}

function FormPips({ form }: { form: boolean[] }) {
  return (
    <div className="flex gap-0.5">
      {form.map((win, i) => {
        const cls = cn(
          "inline-block size-2 rounded-sm",
          win ? "bg-emerald-400" : "bg-red-400/60"
        );
        // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional, no stable id
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}

function RankBadge({ rank }: { rank: LiveGameParticipant["rank"] }) {
  if (!rank) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="text-xs tabular-nums text-muted-foreground">
      {rank.tier[0]}
      {rank.rank} {rank.lp}LP
    </span>
  );
}

function MasteryBadge({ mastery }: { mastery: LiveGameParticipant["mastery"] }) {
  if (!mastery) return null;
  const k =
    mastery.points >= 1000
      ? `${Math.floor(mastery.points / 1000)}k`
      : String(mastery.points);
  return (
    <span className="text-xs text-muted-foreground">
      M{mastery.level} {k}
    </span>
  );
}

// ─── participant card ─────────────────────────────────────────────────────────

function ParticipantCard({
  participant,
  align,
  isUser,
  championName,
  uncertain = false,
}: {
  participant: LiveGameParticipant;
  align: "left" | "right";
  isUser: boolean;
  championName: string | undefined;
  uncertain?: boolean;
}) {
  const isLeft = align === "left";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2",
        isUser ? "bg-card ring-1 ring-primary/40" : "bg-card/60",
        isLeft ? "flex-row" : "flex-row-reverse"
      )}
    >
      <div className="relative shrink-0">
        <ChampionImg
          championId={participant.championId}
          className="size-10 rounded-md bg-muted object-cover"
        />
        {uncertain && (
          <TooltipPrimitive.Root delayDuration={150}>
            <TooltipPrimitive.Trigger asChild>
              <span className="absolute -right-1 -top-1 flex size-4 cursor-default items-center justify-center rounded-full bg-amber-500/90 text-[10px] font-bold text-background">
                ?
              </span>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content
                side="top"
                sideOffset={4}
                className="pointer-events-none z-50 max-w-56 rounded border bg-popover/85 px-2 py-1 text-xs text-popover-foreground shadow-md backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                Lane assignment uncertain — another flex pick on this team competes for
                the same slot.
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        )}
      </div>
      {/* Summoner spells + keystone column */}
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <SummonerSpellIcon id={participant.spell1Id} />
        <SummonerSpellIcon id={participant.spell2Id} />
        <KeystoneIcon id={participant.keystone} />
      </div>
      {/* Name / stats */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-0.5",
          isLeft ? "items-start" : "items-end"
        )}
      >
        <span
          className={cn(
            "truncate text-sm leading-none",
            participant.anonymous
              ? "italic text-muted-foreground"
              : isUser
                ? "font-semibold text-foreground"
                : "font-medium"
          )}
        >
          {participant.anonymous
            ? (championName ?? "Hidden")
            : participant.riotIdGameName}
        </span>
        <div
          className={cn(
            "flex items-center gap-1.5",
            isLeft ? "flex-row" : "flex-row-reverse"
          )}
        >
          <RankBadge rank={participant.rank} />
          <MasteryBadge mastery={participant.mastery} />
        </div>
        {participant.recentForm && participant.recentForm.length > 0 && (
          <FormPips form={participant.recentForm} />
        )}
      </div>
    </div>
  );
}

function BanIcon({ championId }: { championId: number }) {
  if (championId === -1) {
    return <div className="size-7 rounded-sm bg-muted/30 ring-1 ring-border/30" />;
  }
  return (
    <div className="relative size-7">
      <ChampionImg
        championId={championId}
        width={32}
        className="size-full rounded-sm object-cover opacity-50 grayscale"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-[1.5px] w-full rotate-45 bg-red-500/80" />
      </div>
    </div>
  );
}

// ─── composition radar ────────────────────────────────────────────────────────

function LiveCompositionPanel({
  team100,
  team200,
  rolesByChampion,
  allLoaded,
}: {
  team100: LiveGameParticipant[];
  team200: LiveGameParticipant[];
  rolesByChampion: Record<number, string[]>;
  allLoaded: boolean;
}) {
  const blueComp = computeTeamComp(
    team100.map((p) => p.championId),
    rolesByChampion
  );
  const redComp = computeTeamComp(
    team200.map((p) => p.championId),
    rolesByChampion
  );

  const radarData = COMP_AXES.map((axis) => ({
    subject: axis.charAt(0).toUpperCase() + axis.slice(1),
    blue: blueComp[axis],
    red: redComp[axis],
  }));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        Team Composition
      </span>
      {allLoaded ? (
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
            />
            <Radar
              dataKey="blue"
              fill="hsl(220 80% 60%)"
              fillOpacity={0.25}
              stroke="hsl(220 80% 60%)"
              strokeWidth={1.5}
            />
            <Radar
              dataKey="red"
              fill="hsl(0 80% 60%)"
              fillOpacity={0.25}
              stroke="hsl(0 80% 60%)"
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] animate-pulse rounded-lg bg-muted/40" />
      )}
    </div>
  );
}

// ─── main content ─────────────────────────────────────────────────────────────

function LiveContent({
  match,
  account,
}: {
  match: LiveMatch;
  account: LolAccount | undefined;
}) {
  const timer = useGameTimer(match);

  const allChampionIds = match.participants.map((p) => p.championId);
  const championResults = useQueries({
    queries: allChampionIds.map((id) => ({
      queryKey: ["cdragon-champion", id] as const,
      queryFn: () => fetchChampionInfo(id),
      staleTime: Number.POSITIVE_INFINITY,
    })),
  });
  const rolesByChampion: Record<number, string[]> = Object.fromEntries(
    allChampionIds.map((id, i) => [id, championResults[i]?.data?.roles ?? []])
  );
  const nameByChampion: Record<number, string | undefined> = Object.fromEntries(
    allChampionIds.map((id, i) => [id, championResults[i]?.data?.name])
  );
  const allLoaded = championResults.every((r) => !r.isPending);

  const team100Raw = match.participants.filter((p) => p.teamId === 100);
  const team200Raw = match.participants.filter((p) => p.teamId === 200);
  const isRift = match.gameMode === "CLASSIC";
  // Wait until cdragon role data has arrived before running the cost-matrix
  // assignment — without role tags every permutation has equal cost and every
  // pair gets flagged uncertain, which is noisy. Show the raw order until then.
  const useLaneAssignment = isRift && allLoaded;
  const team100: LaneAssignment[] = useLaneAssignment
    ? assignLanes(team100Raw, rolesByChampion)
    : team100Raw.map((p) => ({ participant: p, lane: null, uncertain: false }));
  const team200: LaneAssignment[] = useLaneAssignment
    ? assignLanes(team200Raw, rolesByChampion)
    : team200Raw.map((p) => ({ participant: p, lane: null, uncertain: false }));
  const bans100 = match.bans
    .filter((b) => b.teamId === 100)
    .sort((a, b) => a.pickTurn - b.pickTurn);
  const bans200 = match.bans
    .filter((b) => b.teamId === 200)
    .sort((a, b) => a.pickTurn - b.pickTurn);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-500/30">
            <span className="size-1.5 animate-pulse rounded-full bg-red-400" />
            LIVE
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums">{timer}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
            {queueLabel(match.queueId)}
          </span>
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
            {mapLabel(match.mapId)}
          </span>
        </div>
      </div>

      {/* Bans */}
      {(bans100.length > 0 || bans200.length > 0) && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1">
            {bans100.map((b) => (
              <BanIcon key={b.pickTurn} championId={b.championId} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Bans</span>
          <div className="flex gap-1">
            {bans200.map((b) => (
              <BanIcon key={b.pickTurn} championId={b.championId} />
            ))}
          </div>
        </div>
      )}

      {/* 5v5 grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {team100.map((a) => (
            <ParticipantCard
              key={a.participant.puuid}
              participant={a.participant}
              align="left"
              isUser={isUserParticipant(a.participant, account)}
              championName={nameByChampion[a.participant.championId]}
              uncertain={a.uncertain}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {team200.map((a) => (
            <ParticipantCard
              key={a.participant.puuid}
              participant={a.participant}
              align="right"
              isUser={isUserParticipant(a.participant, account)}
              championName={nameByChampion[a.participant.championId]}
              uncertain={a.uncertain}
            />
          ))}
        </div>
      </div>

      {/* Compositional analysis */}
      <LiveCompositionPanel
        team100={team100.map((a) => a.participant)}
        team200={team200.map((a) => a.participant)}
        rolesByChampion={rolesByChampion}
        allLoaded={allLoaded}
      />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

function LivePage() {
  const { accountSlug } = Route.useParams();
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useLiveGame(account);

  // Track whether we were ever in a game so we can show "Game ended" vs "Not in game"
  const [hadGame, setHadGame] = useState(false);
  useEffect(() => {
    if (data) setHadGame(true);
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link
          to="/lol/$accountSlug"
          params={{ accountSlug }}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Profile
        </Link>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-4">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </div>
      ) : data ? (
        <LiveContent match={data} account={account} />
      ) : hadGame ? (
        <EmptyState
          illustration={<EmptyLiveGameIllustration />}
          title="Game over"
          hint="The match wrapped — head back to your profile for the post-game read."
          action={
            <Link
              to="/lol/$accountSlug"
              params={{ accountSlug }}
              className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80"
            >
              Back to profile
            </Link>
          }
          className="py-12"
        />
      ) : (
        <EmptyState
          illustration={<EmptyLiveGameIllustration />}
          title="Not currently in a game"
          hint="Live match data appears here while you're queued or in champ select."
          className="py-12"
        />
      )}
    </div>
  );
}
