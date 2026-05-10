import { cn } from "@/lib/utils";
import { KeystoneIcon } from "@/lol/_shared/keystone-icon";
import { SummonerSpellIcon } from "@/lol/_shared/summoner-spell-icon";
import { useAccountFromSlug } from "@/lol/_shared/use-account-from-slug";
import { useLiveGame, useLiveGameEvents } from "@/lol/matches/use-live-match";
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

// Spectator-V5 doesn't return teamPosition, so infer lane from Smite + champion role tags.
// Heuristic accuracy ~80% — off-meta picks (Tahm Kench top, Lux support) may misorder.
const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Lane = (typeof LANE_ORDER)[number];

const SMITE_SPELL_ID = 11;

function inferLane(p: LiveGameParticipant, roles: string[]): Lane {
  if (p.spell1Id === SMITE_SPELL_ID || p.spell2Id === SMITE_SPELL_ID) return "JUNGLE";
  const primary = roles[0];
  if (primary === "marksman") return "BOTTOM";
  if (primary === "support") return "SUPPORT";
  if (primary === "mage" || primary === "assassin") return "MID";
  return "TOP";
}

function sortByLane(
  team: LiveGameParticipant[],
  rolesByChampion: Record<number, string[]>
): LiveGameParticipant[] {
  return [...team]
    .map((p, i) => ({
      p,
      i,
      score: LANE_ORDER.indexOf(inferLane(p, rolesByChampion[p.championId] ?? [])),
    }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map(({ p }) => p);
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
}: {
  participant: LiveGameParticipant;
  align: "left" | "right";
  isUser: boolean;
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
      <ChampionImg
        championId={participant.championId}
        className="size-10 shrink-0 rounded-md bg-muted object-cover"
      />
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
            isUser ? "font-semibold text-foreground" : "font-medium"
          )}
        >
          {participant.riotIdGameName || "—"}
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
  const allLoaded = championResults.every((r) => !r.isPending);

  const team100Raw = match.participants.filter((p) => p.teamId === 100);
  const team200Raw = match.participants.filter((p) => p.teamId === 200);
  const isRift = match.gameMode === "CLASSIC";
  const team100 = isRift ? sortByLane(team100Raw, rolesByChampion) : team100Raw;
  const team200 = isRift ? sortByLane(team200Raw, rolesByChampion) : team200Raw;
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
          {team100.map((p) => (
            <ParticipantCard
              key={p.puuid}
              participant={p}
              align="left"
              isUser={isUserParticipant(p, account)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {team200.map((p) => (
            <ParticipantCard
              key={p.puuid}
              participant={p}
              align="right"
              isUser={isUserParticipant(p, account)}
            />
          ))}
        </div>
      </div>

      {/* Compositional analysis */}
      <LiveCompositionPanel
        team100={team100}
        team200={team200}
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
  useLiveGameEvents(account);

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
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">Game over.</p>
          <Link
            to="/lol/$accountSlug"
            params={{ accountSlug }}
            className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/80"
          >
            Back to profile
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-2xl">💤</span>
          <p className="text-muted-foreground">Not currently in a game.</p>
        </div>
      )}
    </div>
  );
}
