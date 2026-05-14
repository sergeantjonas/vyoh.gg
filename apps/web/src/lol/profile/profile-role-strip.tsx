import {
  ROLE_LABEL,
  ROLE_ORDER,
  RoleIcon,
  type RolePosition,
  isRolePosition,
} from "@/lol/_shared/role-icon";
import { useSeriousMatches } from "@/lol/_shared/serious-queues/serious-queues";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const ARAM_HEAVY_RATIO = 0.9;

interface RoleSlot {
  position: RolePosition;
  games: number;
  wins: number;
  share: number;
  wr: number;
}

function aggregate(matches: MatchSummary[]): {
  slots: RoleSlot[];
  positioned: number;
  total: number;
} {
  let total = 0;
  let positioned = 0;
  const map = new Map<RolePosition, { games: number; wins: number }>();
  for (const m of matches) {
    if (m.remake) continue;
    total += 1;
    if (!isRolePosition(m.teamPosition)) continue;
    positioned += 1;
    const prev = map.get(m.teamPosition) ?? { games: 0, wins: 0 };
    map.set(m.teamPosition, {
      games: prev.games + 1,
      wins: prev.wins + (m.win ? 1 : 0),
    });
  }
  const slots: RoleSlot[] = ROLE_ORDER.map((position) => {
    const stat = map.get(position) ?? { games: 0, wins: 0 };
    return {
      position,
      games: stat.games,
      wins: stat.wins,
      share: positioned === 0 ? 0 : stat.games / positioned,
      wr: stat.games === 0 ? 0 : stat.wins / stat.games,
    };
  });
  slots.sort((a, b) => b.games - a.games);
  return { slots, positioned, total };
}

function Slot({ slot, anyPlayed }: { slot: RoleSlot; anyPlayed: boolean }) {
  const muted = slot.games === 0;
  const wrPct = Math.round(slot.wr * 100);
  const sharePct = Math.round(slot.share * 100);
  return (
    <div className="flex flex-col items-center gap-1 px-1">
      <RoleIcon
        position={slot.position}
        className={muted ? "size-6 opacity-25" : "size-6 opacity-95"}
      />
      <span
        className={
          muted
            ? "text-[10px] text-muted-foreground/40"
            : "text-[10px] text-muted-foreground"
        }
      >
        {ROLE_LABEL[slot.position]}
      </span>
      {muted ? (
        <span className="text-[10px] text-muted-foreground/30">—</span>
      ) : (
        <span className="text-xs tabular-nums text-foreground/80">
          {slot.games}
          {anyPlayed && <span className="text-muted-foreground/60"> · {sharePct}%</span>}
        </span>
      )}
      {!muted && slot.games >= 3 && (
        <span className="text-[10px] tabular-nums text-muted-foreground/60">
          {wrPct}% WR
        </span>
      )}
    </div>
  );
}

export function ProfileRoleStrip() {
  // Roles only exist in SR queues, and we want the WR signal to come from
  // serious play — so this surface anchors to the user's serious-queues set.
  const { matches } = useSeriousMatches();
  const { slots, positioned, total } = useMemo(() => aggregate(matches ?? []), [matches]);

  if (!matches || total === 0) return null;

  const aramRatio = (total - positioned) / total;
  const heavyAram = aramRatio > ARAM_HEAVY_RATIO;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Roles</h3>
      {heavyAram ? (
        <p className="text-xs text-muted-foreground/70">
          Mostly ARAM — role data limited.
        </p>
      ) : null}
      <div className="grid grid-cols-5 gap-1 rounded-lg border bg-card/40 px-2 py-3">
        {slots.map((slot) => (
          <Slot key={slot.position} slot={slot} anyPlayed={positioned > 0} />
        ))}
      </div>
    </section>
  );
}
