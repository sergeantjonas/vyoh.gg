import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export interface RitualSignal {
  id: string;
  label: string;
  verdict: ReactNode;
  detail?: string | undefined;
  tone: "neutral" | "positive" | "warning";
}

const TONE_DOT: Record<RitualSignal["tone"], string> = {
  neutral: "bg-muted-foreground/30",
  positive: "bg-emerald-500/70",
  warning: "bg-rose-500/70",
};

export function SignalTile({ signal, index }: { signal: RitualSignal; index: number }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      layout
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: reduced ? 0 : index * 0.05 }}
      className="flex h-full flex-col gap-1 rounded-lg border bg-card/40 px-3 py-2.5"
    >
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${TONE_DOT[signal.tone]}`} />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {signal.label}
        </span>
      </div>
      <div className="text-sm leading-snug text-foreground/90">{signal.verdict}</div>
      {signal.detail && (
        <div className="text-[10px] text-muted-foreground/60">{signal.detail}</div>
      )}
    </m.div>
  );
}
