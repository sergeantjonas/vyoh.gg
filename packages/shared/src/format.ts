export function formatDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function formatGameTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// Formats gold as "1.2k" for ≥1000 or "800g" for <1000.
// match-lane-phase previously omitted the "g" suffix — this is the canonical form.
export function formatGold(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)}k` : `${g}g`;
}

// Compact playtime for Steam surfaces (minutes input). library-tile-hovercard
// uses a verbose "min"/"hrs" variant and stays inline.
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

// Compact playtime for LoL surfaces (seconds input) — one-decimal hours
// because a champion's accumulated playtime is fine-grained (72.6h reads
// as a meaningful 36-minute step where Steam's 73h vs 74h doesn't).
// Sub-hour totals fall back to whole minutes.
export function formatPlaytimeFromSeconds(sec: number): string {
  const hours = sec / 3600;
  if (hours < 1) return `${Math.round(sec / 60)}m`;
  return `${hours.toFixed(1)}h`;
}

export function formatHoursMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// KDA ratio rendered with two decimals. (kills + assists) / deaths, with a
// zero-deaths fallback to a whole-number "perfect" annotation handled by the
// caller — this helper only formats the ratio itself.
export function formatKda(ratio: number): string {
  return ratio.toFixed(2);
}

// LP delta with explicit sign for non-negative values. Zero renders as "+0"
// to stay visually aligned with positive results in tabular columns.
export function formatLpDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

// 0..1 ratio → integer percent. Pass decimals>0 only when the surface needs
// sub-point precision (rare; most win-rate displays round to whole percent).
export function formatPercent(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)}%`;
}
