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
/** Primary metric series — "your" trajectory line and its dots. */
export const CHART_SERIES = "var(--accent, #34d399)";
/** Fitted/secondary reference series (trend lines, baselines). */
export const CHART_TREND = "#a78bfa";
/** Semantic positive: wins, gold lead, upward streaks. */
export const CHART_POSITIVE = "#34d399";
/** Semantic negative: losses, deficits, downward streaks. */
export const CHART_NEGATIVE = "#fb7185";
