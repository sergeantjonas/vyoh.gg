/**
 * Cross-stream "how busy has the last day been" scalar surfaced on `/`.
 * Drives ambient hero chroma — busier day → more saturated palette, quieter
 * day → more muted. Soft-normalised to [0, 1] so the consumer applies the
 * value directly as a multiplier without re-clamping.
 *
 * `lolMatches24h` is a rolling-24h count of non-remake matches.
 * `steamMinutesToday` is closed-session minutes within the current
 * `Europe/Brussels` calendar day clamped to `[dayStart, asOf]`.
 */
export interface HomeActivityIntensity {
  lolMatches24h: number;
  steamMinutesToday: number;
  /** Soft-normalised activity in [0, 1]; max of per-stream norms. */
  intensity: number;
  /** ISO timestamp the snapshot was computed at. */
  asOf: string;
  /** IANA timezone used to anchor the "today" boundary. */
  timeZone: string;
}
