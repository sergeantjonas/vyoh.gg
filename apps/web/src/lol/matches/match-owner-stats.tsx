import { SectionTitle } from "@/components/ui/section-title";
import type { ParticipantDetail } from "@vyoh/shared";
import { m, useReducedMotion } from "motion/react";

const springIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring", stiffness: 280, damping: 28, delay: 0.28 },
} as const;

function fmtSec(s: number) {
  const total = Math.round(s);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const MK_CHIPS = [
  { key: "double" as const, label: "Double", cls: "bg-slate-400/15 text-slate-300" },
  { key: "triple" as const, label: "Triple", cls: "bg-emerald-400/15 text-emerald-300" },
  { key: "quadra" as const, label: "Quadra", cls: "bg-amber-400/15 text-amber-300" },
  {
    key: "penta" as const,
    label: "Penta",
    cls: "bg-red-400/15 text-red-300 font-semibold",
  },
] as const;

export function MatchOwnerStats({
  detail,
  myPuuid,
}: {
  detail: { participants: ParticipantDetail[] };
  myPuuid?: string | undefined;
}) {
  const reduced = useReducedMotion();

  const me = myPuuid ? detail.participants.find((p) => p.puuid === myPuuid) : undefined;
  if (!me?.owner) return null;

  const {
    totalTimeCCDealt: cc,
    totalTimeSpentDead: dead,
    longestTimeSpentLiving: alive,
  } = me.owner.survival;
  const mk = me.owner.multikills;
  const hasMk = mk.double > 0 || mk.triple > 0 || mk.quadra > 0 || mk.penta > 0;

  return (
    <m.section
      initial={reduced ? {} : springIn.initial}
      animate={springIn.animate}
      transition={springIn.transition}
      className="flex flex-col gap-3"
    >
      <SectionTitle>Stats</SectionTitle>
      <div className="flex flex-col gap-3 rounded-md border bg-card/60 p-4 backdrop-blur-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">CC dealt</span>
            <span className="font-mono text-xs tabular-nums">{fmtSec(cc)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Time dead</span>
            <span className="font-mono text-xs tabular-nums">{fmtSec(dead)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Longest alive</span>
            <span className="font-mono text-xs tabular-nums">{fmtSec(alive)}</span>
          </div>
        </div>
        {hasMk && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
            {MK_CHIPS.filter(({ key }) => mk[key] > 0).map(({ key, label, cls }) => (
              <span
                key={key}
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}
              >
                {mk[key]}× {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </m.section>
  );
}
