// Baseline: personal — per-role WR vs your overall WR across the window.
import {
  ROLE_LABEL,
  ROLE_ORDER,
  RoleIcon,
  type RolePosition,
  isRolePosition,
} from "@/lol/_shared/role-icon";
import { ConclusionCard } from "@/lol/trends/_shared/conclusion-card";
import type { MatchSummary } from "@vyoh/shared";
import { useMemo } from "react";

const MIN_BAR_SAMPLE = 3;
const MIN_PRESCRIPTION_SAMPLE = 5;
const PRESCRIPTION_DELTA = 0.15;
const POSITIONLESS_RATIO_THRESHOLD = 0.7;

interface RoleStat {
  position: RolePosition;
  games: number;
  wins: number;
  wr: number;
}

function aggregate(matches: MatchSummary[]): {
  rows: RoleStat[];
  positioned: number;
  total: number;
} {
  let total = 0;
  let positioned = 0;
  const map = new Map<RolePosition, RoleStat>();
  for (const m of matches) {
    if (m.remake) continue;
    total += 1;
    if (!isRolePosition(m.teamPosition)) continue;
    positioned += 1;
    const prev = map.get(m.teamPosition) ?? {
      position: m.teamPosition,
      games: 0,
      wins: 0,
      wr: 0,
    };
    map.set(m.teamPosition, {
      ...prev,
      games: prev.games + 1,
      wins: prev.wins + (m.win ? 1 : 0),
    });
  }
  const rows = ROLE_ORDER.map(
    (position) => map.get(position) ?? { position, games: 0, wins: 0, wr: 0 }
  ).map((r) => ({ ...r, wr: r.games === 0 ? 0 : r.wins / r.games }));
  rows.sort((a, b) => b.games - a.games);
  return { rows, positioned, total };
}

function RoleBar({ row }: { row: RoleStat }) {
  const insufficient = row.games < MIN_BAR_SAMPLE;
  const wrPct = Math.round(row.wr * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <RoleIcon
        position={row.position}
        className={insufficient ? "size-5 opacity-35" : "size-5 opacity-90"}
      />
      <span
        className={`w-12 shrink-0 ${insufficient ? "text-muted-foreground/50" : "text-muted-foreground"}`}
      >
        {ROLE_LABEL[row.position]}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/30">
        {!insufficient && (
          <div
            className="h-full rounded-full bg-sky-500/60 transition-[width] duration-500"
            style={{ width: `${wrPct}%` }}
          />
        )}
      </div>
      {insufficient ? (
        <span className="w-20 shrink-0 text-right text-[10px] text-muted-foreground/50">
          {row.games === 0 ? "no games" : "too few games"}
        </span>
      ) : (
        <>
          <span className="w-9 tabular-nums text-right text-muted-foreground/80">
            {wrPct}%
          </span>
          <span className="w-7 tabular-nums text-right text-[10px] text-muted-foreground/60">
            {row.games}g
          </span>
        </>
      )}
    </div>
  );
}

export function TrendRolePerformance({
  current,
  previous: _previous,
}: {
  current: MatchSummary[];
  previous: MatchSummary[];
}) {
  const { rows, positioned, total } = useMemo(() => aggregate(current), [current]);

  if (positioned === 0) {
    return (
      <ConclusionCard
        title="Role performance"
        sampleSize={0}
        verdict={
          total === 0
            ? "Not enough games yet."
            : "ARAM and Arena games don't carry role data — play a Rift game to see this."
        }
        empty
      />
    );
  }

  const positionlessRatio = total === 0 ? 0 : (total - positioned) / total;
  const heavyAram = positionlessRatio > POSITIONLESS_RATIO_THRESHOLD;

  const eligible = rows.filter((r) => r.games >= MIN_BAR_SAMPLE);
  if (eligible.length === 0) {
    return (
      <ConclusionCard
        title="Role performance"
        sampleSize={positioned}
        verdict={
          heavyAram
            ? "Mostly ARAM in this window — not enough Rift games on any single role yet."
            : `Need ${MIN_BAR_SAMPLE}+ games on a role to read its WR.`
        }
        empty
        evidence={
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <RoleBar key={r.position} row={r} />
            ))}
          </div>
        }
      />
    );
  }

  const best = [...eligible].sort((a, b) => b.wr - a.wr)[0];
  if (!best) {
    return (
      <ConclusionCard
        title="Role performance"
        sampleSize={positioned}
        verdict="No role data yet."
        empty
      />
    );
  }
  const wrPct = Math.round(best.wr * 100);
  const gamesLabel = `${best.games} game${best.games === 1 ? "" : "s"}`;
  // Heavy-ARAM windows still get a real "strongest role" verdict — the bars
  // below show the underlying data either way — but we tag it so the user
  // knows the Rift sample is the minority of the window. Prescription stays
  // suppressed in that case to avoid pushing climb advice off a biased read.
  const verdict = heavyAram
    ? `Strongest Rift role is ${ROLE_LABEL[best.position]} — ${wrPct}% over ${gamesLabel} (mostly ARAM otherwise).`
    : `Strongest on ${ROLE_LABEL[best.position]} — ${wrPct}% over ${gamesLabel}.`;

  let prescription: string | undefined;
  if (!heavyAram) {
    const ranked = eligible.filter((r) => r.games >= MIN_PRESCRIPTION_SAMPLE);
    if (ranked.length >= 2) {
      const sortedByWr = [...ranked].sort((a, b) => b.wr - a.wr);
      const top = sortedByWr[0];
      const bottom = sortedByWr[sortedByWr.length - 1];
      if (top && bottom && top.position !== bottom.position) {
        const delta = top.wr - bottom.wr;
        if (delta >= PRESCRIPTION_DELTA) {
          prescription = `Consider climbing on ${ROLE_LABEL[top.position]}.`;
        }
      }
    }
  }

  return (
    <ConclusionCard
      title="Role performance"
      sampleSize={positioned}
      verdict={verdict}
      verdictMarkdown={verdict}
      prescription={prescription}
      prescriptionMarkdown={prescription}
      evidence={
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <RoleBar key={r.position} row={r} />
          ))}
        </div>
      }
    />
  );
}
