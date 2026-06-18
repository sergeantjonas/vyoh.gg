// Chart color slots, consolidated from the per-chart hardcoded hex that the
// 2026-06-12 visual-excellence audit flagged (V8). Pick by role, never by
// color — and never introduce a new hardcoded series hex at a call site.
//
// Series slots participate in the per-entity accent cascade
// (accent-color-system.md): `--accent` is published per-subject by atmosphere
// claims and is otherwise unset, so the fallback hex keeps today's look on
// every route without a claim. Chrome slots are plain theme tokens. The
// positive/negative pair is semantic (win/loss, gain/deficit — the app-wide
// emerald/rose pairing) and deliberately does NOT follow the accent cascade:
// semantics must not follow decoration.
//
// Deeper theme participation (e.g. CHART_TREND → `--theme-muted`) is a
// visible design change that needs eyes on the Trends tab first — don't flip
// it silently in a refactor.

/** Cartesian grid lines. */
export const CHART_GRID = "var(--border)";
/** Axis tick label fill. */
export const CHART_AXIS = "var(--muted-foreground)";
/** Hover cursor / crosshair stroke. */
export const CHART_CURSOR = "var(--border)";
/** Primary metric series — "your" trajectory line and its dots. Follows the
 *  per-subject accent cascade via `--accent`. NB: only routes that publish an
 *  atmosphere/asset claim set `--accent`; on routes that don't (every LoL route
 *  — the splash backdrop is a separate mechanism), `--accent` stays the neutral
 *  shadcn token (dark grey in dark theme), so this resolves grey, not the
 *  fallback emerald. That's fine for a subdued line under a coloured trend
 *  overlay (trend-kda); it is NOT fine when the series IS the hero shape. */
export const CHART_SERIES = "var(--accent, #34d399)";
/** Primary series for a hero data shape (filled radar polygon, solo area) on a
 *  surface that does NOT participate in the accent cascade — resolved at
 *  author-time so it can't collapse to the neutral `--accent` token. Same
 *  emerald as CHART_SERIES's nominal fallback; distinct from the semantic
 *  CHART_POSITIVE (win/loss) so decoration never reads as a win/loss signal. */
export const CHART_SERIES_STATIC = "#34d399";
/** Fitted/secondary reference series (trend lines, baselines). */
export const CHART_TREND = "#a78bfa";
/** Semantic positive: wins, gold lead, upward streaks. */
export const CHART_POSITIVE = "#34d399";
/** Semantic negative: losses, deficits, downward streaks. */
export const CHART_NEGATIVE = "#fb7185";
