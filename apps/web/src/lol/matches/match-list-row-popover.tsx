import { cn } from "@/lib/utils";
import { ChampionSquareIcon } from "@/lol/_shared/champion-square-icon";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useQuery } from "@tanstack/react-query";
import type { MatchDetail, ParticipantDetail } from "@vyoh/shared";
import { type ReactNode, useEffect, useState } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

const API_URL = "http://localhost:2010";

async function fetchDetail(matchId: string): Promise<MatchDetail> {
  const res = await fetch(`${API_URL}/lol/matches/${encodeURIComponent(matchId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<MatchDetail>;
}

function PlayerRow({
  participant,
  isUser,
  teamColor,
}: {
  participant: ParticipantDetail;
  isUser: boolean;
  teamColor: "blue" | "red";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded px-1 py-0.5 text-xs leading-none",
        isUser
          ? teamColor === "blue"
            ? "bg-sky-900/40 font-medium text-sky-100"
            : "bg-rose-900/40 font-medium text-rose-100"
          : teamColor === "blue"
            ? "text-sky-400/75"
            : "text-rose-400/75"
      )}
    >
      <ChampionSquareIcon
        championName={participant.championName}
        className="size-4 shrink-0 rounded-sm"
      />
      <span className="max-w-28 truncate">{participant.riotIdGameName}</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex gap-3">
      {[0, 1].map((t) => (
        <div key={t} className="flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
            <div key={i} className="flex items-center gap-1.5 px-1 py-0.5">
              <div className="size-4 shrink-0 animate-pulse rounded-sm bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MatchListRowPopover({
  matchId,
  userChampion,
  children,
}: {
  matchId: string;
  userChampion: string;
  children: ReactNode;
}) {
  const [fetchEnabled, setFetchEnabled] = useState(false);
  // Hover is desktop-only; touch devices never trigger the tooltip, so don't
  // mount it. Below the lg breakpoint the side panel doesn't fit horizontally,
  // so flip to a vertical placement.
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");
  const isWide = useMediaQuery("(min-width: 1024px)");

  const { data } = useQuery<MatchDetail>({
    queryKey: ["lol", "match", matchId],
    queryFn: () => fetchDetail(matchId),
    enabled: fetchEnabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (!canHover) return <>{children}</>;

  const team100 = data?.participants.filter((p) => p.teamId === 100) ?? [];
  const team200 = data?.participants.filter((p) => p.teamId === 200) ?? [];

  return (
    <TooltipPrimitive.Root delayDuration={400}>
      <TooltipPrimitive.Trigger asChild>
        <div onMouseEnter={() => setFetchEnabled(true)}>{children}</div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={isWide ? "right" : "bottom"}
          align="center"
          sideOffset={8}
          collisionPadding={12}
          className="pointer-events-none z-50 rounded-md border bg-popover/90 p-2 shadow-xl backdrop-blur-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95"
        >
          {!data ? (
            <SkeletonRows />
          ) : (
            <div className="flex gap-2">
              <div className="flex flex-col gap-0.5">
                {team100.map((p) => (
                  <PlayerRow
                    key={p.puuid}
                    participant={p}
                    isUser={p.championName === userChampion}
                    teamColor="blue"
                  />
                ))}
              </div>
              <div className="w-px self-stretch bg-border/40" />
              <div className="flex flex-col gap-0.5">
                {team200.map((p) => (
                  <PlayerRow
                    key={p.puuid}
                    participant={p}
                    isUser={p.championName === userChampion}
                    teamColor="red"
                  />
                ))}
              </div>
            </div>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
