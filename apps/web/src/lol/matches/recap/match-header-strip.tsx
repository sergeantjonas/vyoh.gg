import { GoldIcon, KillsIcon } from "@/components/game-icons";
import { useMatchTimeline } from "@/lol/matches/use-match-timeline";
import type { TeamSummary } from "@vyoh/shared";
import { SoulChip, TeamObjectiveStrip, computeSoul } from "./team-objective-strip";

export function MatchHeaderStrip({
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
