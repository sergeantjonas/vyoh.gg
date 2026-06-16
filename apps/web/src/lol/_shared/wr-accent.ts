// Win-rate → Tailwind class buckets, shared by the LoL profile surfaces that
// render win-rate bars (Synergy, Duos). Four tiers (strong / positive / neutral
// / losing) so a row's colour reads its win rate at a glance. Kept here rather
// than inlined per-component so the thresholds and class sets don't drift apart.
export interface WrAccent {
  /** Text colour for the WR percentage. */
  text: string;
  /** Filled portion of the win-rate bar. */
  bar: string;
  /** Track behind the bar. */
  rail: string;
  /** Left border accent on the row. */
  rowBorder: string;
}

export function wrAccent(wr: number): WrAccent {
  if (wr >= 0.6) {
    return {
      text: "text-emerald-400",
      bar: "bg-emerald-400/70",
      rail: "bg-emerald-400/15",
      rowBorder: "border-l-emerald-400/50",
    };
  }
  if (wr >= 0.5) {
    return {
      text: "text-emerald-500/90",
      bar: "bg-emerald-500/55",
      rail: "bg-emerald-500/10",
      rowBorder: "border-l-emerald-500/30",
    };
  }
  if (wr >= 0.4) {
    return {
      text: "text-muted-foreground",
      bar: "bg-muted-foreground/40",
      rail: "bg-muted-foreground/10",
      rowBorder: "border-l-muted-foreground/20",
    };
  }
  return {
    text: "text-rose-400",
    bar: "bg-rose-500/60",
    rail: "bg-rose-500/10",
    rowBorder: "border-l-rose-400/50",
  };
}
