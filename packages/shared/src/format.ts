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
// uses a verbose "min"/"hrs" variant and champion-table takes seconds — both stay inline.
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

export function formatHoursMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
