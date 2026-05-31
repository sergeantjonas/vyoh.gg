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

// Compact playtime for Steam surfaces (minutes input). The verbose
// "min"/"hrs" Steam-client variant is formatPlaytimeVerbose below.
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString("en-US")}h`;
}

// Verbose Steam-client-style "TIME PLAYED" playtime (minutes input). Sub-hour
// shows minutes ("18 min"); single-digit hours get tenths precision
// ("3.4 hrs"); ≥10h rounds to whole hours ("73 hrs"). Zero renders "0 min"
// to mirror Steam's never-played fallback. Used in library hovercards where
// the Steam-UI parity matters; everywhere else uses the compact formatPlaytime.
export function formatPlaytimeVerbose(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} hrs`;
  return `${Math.round(hours).toLocaleString("en-US")} hrs`;
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

// Compact "Xm/h/d ago" relative timestamp. Lives here because the same
// three-tier shape (minutes < 60 → "Xm ago", hours < 24 → "Xh ago",
// else "Xd ago") was inlined across the command palette, match rows, and
// several Steam surfaces. Sub-minute diffs collapse to "just now" — the
// earlier "0m ago" form read awkwardly in suffix positions
// ("checked 0m ago"). Reads naturally in every existing caller's framing.
export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Intl.RelativeTimeFormat-backed relative timestamp covering the full
// minute → year chain ("5 minutes ago", "yesterday", "3 months ago",
// "2 years ago"). Distinct from formatTimeAgo, which is the compact
// suffix-style form ("5m ago") preferred where horizontal space is tight.
// Used by Steam library/game surfaces where the long Intl form reads
// naturally in evidence rows and hovercard meta lines.
const relativeTimeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

export function relativeTimeAgo(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return relativeTimeFormatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTimeFormatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeTimeFormatter.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 24) return relativeTimeFormatter.format(months, "month");
  const years = Math.round(days / 365);
  return relativeTimeFormatter.format(years, "year");
}
