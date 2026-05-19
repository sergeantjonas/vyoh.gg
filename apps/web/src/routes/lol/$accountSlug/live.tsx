import { EmptyLiveGameIllustration, EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { KeystoneIcon } from "@/lol/_shared/assets/keystone-icon";
import { SummonerSpellIcon } from "@/lol/_shared/assets/summoner-spell-icon";
import { type LaneAssignment, assignLanes } from "@/lol/live/lane-assignment";
import {
  COMP_AXES,
  championFallbackUrl,
  championPrimaryUrl,
  computeTeamComp,
  fetchChampionInfo,
  formatSeconds,
  isUserParticipant,
  mapLabel,
  queueLabel,
} from "@/lol/live/live-helpers";
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
