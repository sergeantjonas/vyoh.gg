import { cn } from "@/lib/utils";
import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function EmptyState({
  illustration,
  title,
  hint,
  action,
  className,
}: {
  illustration: ReactNode;
  title: string;
  hint?: string | undefined;
  action?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <m.div
      initial={reduced ? {} : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-10 text-center",
        className
      )}
    >
      <div className="text-muted-foreground/40">{illustration}</div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm text-foreground/80">{title}</p>
        {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </m.div>
  );
}

const SVG_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function EmptyMatchesIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 110"
      width="140"
      className={className}
      aria-hidden="true"
      {...SVG_PROPS}
    >
      <rect x="20" y="10" width="120" height="22" rx="4" strokeDasharray="3 3" />
      <circle cx="32" cy="21" r="5" opacity="0.6" />
      <line x1="46" y1="18" x2="120" y2="18" opacity="0.4" />
      <line x1="46" y1="24" x2="92" y2="24" opacity="0.3" />
      <rect
        x="20"
        y="42"
        width="120"
        height="22"
        rx="4"
        strokeDasharray="3 3"
        opacity="0.6"
      />
      <rect
        x="20"
        y="74"
        width="120"
        height="22"
        rx="4"
        strokeDasharray="3 3"
        opacity="0.3"
      />
    </svg>
  );
}

export function EmptyLpHistoryIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 100"
      width="140"
      className={className}
      aria-hidden="true"
      {...SVG_PROPS}
    >
      <line x1="22" y1="18" x2="22" y2="78" />
      <line x1="22" y1="78" x2="142" y2="78" />
      <line x1="22" y1="48" x2="142" y2="48" opacity="0.55" strokeDasharray="3 4" />
      <circle cx="22" cy="48" r="2.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EmptyChampionIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 130"
      width="100"
      className={className}
      aria-hidden="true"
      {...SVG_PROPS}
    >
      <rect x="10" y="10" width="80" height="110" rx="7" strokeDasharray="4 4" />
      <path d="M 14 92 L 86 32" opacity="0.25" />
      <path d="M 14 76 L 86 16" opacity="0.18" />
      <line x1="18" y1="104" x2="64" y2="104" opacity="0.55" strokeDasharray="3 3" />
      <line x1="18" y1="112" x2="48" y2="112" opacity="0.35" strokeDasharray="2 3" />
    </svg>
  );
}

export function EmptyDuosIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 80"
      width="140"
      className={className}
      aria-hidden="true"
      {...SVG_PROPS}
    >
      <rect x="14" y="18" width="58" height="44" rx="6" />
      <circle cx="43" cy="40" r="7" fill="currentColor" stroke="none" opacity="0.45" />
      <line x1="74" y1="40" x2="86" y2="40" opacity="0.4" strokeDasharray="2 3" />
      <rect
        x="88"
        y="18"
        width="58"
        height="44"
        rx="6"
        strokeDasharray="3 4"
        opacity="0.65"
      />
      <circle cx="117" cy="40" r="7" strokeDasharray="2 3" opacity="0.5" />
    </svg>
  );
}

export function EmptyLiveGameIllustration({ className }: { className?: string }) {
  const rows = [10, 26, 42, 58, 74];
  return (
    <svg
      viewBox="0 0 160 100"
      width="140"
      className={className}
      aria-hidden="true"
      {...SVG_PROPS}
    >
      {rows.map((y, i) => (
        <g key={y} opacity={1 - i * 0.12}>
          <rect x="14" y={y} width="60" height="12" rx="2" strokeDasharray="3 3" />
          <rect x="86" y={y} width="60" height="12" rx="2" strokeDasharray="3 3" />
        </g>
      ))}
      <line x1="80" y1="6" x2="80" y2="90" opacity="0.3" strokeDasharray="2 5" />
    </svg>
  );
}
