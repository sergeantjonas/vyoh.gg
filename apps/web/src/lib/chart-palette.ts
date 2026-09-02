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
/** Primary metric series — "your" trajectory line / dots / hero polygon. Follows
 *  the project's per-entity accent cascade via `--theme-fg` (the contrast-locked
 *  tier of `--theme-color`: dark theme forces lightness ≥ 0.74, so every subject
 *  hue stays legible against the dark card). `--theme-color` is published per
 *  subject across the app — LoL via `championTheme().dominantHex` (champion
 *  detail / match detail / splash backdrop), recap via atmosphere claims — and
 *  has a legible blue global default, so this never resolves to a neutral token.
 *  NB: do NOT point this at `--accent`; that's shadcn-reserved for neutral hover
 *  surfaces and is unset on LoL routes (see accent-color-system.md). */
export const CHART_SERIES = "var(--theme-fg, #34d399)";
/** Fitted/secondary reference series (trend lines, baselines). */
export const CHART_TREND = "#a78bfa";
/** Semantic positive: wins, gold lead, upward streaks. */
export const CHART_POSITIVE = "#34d399";
/** Semantic negative: losses, deficits, downward streaks. */
export const CHART_NEGATIVE = "#fb7185";
/** Riot's side colours for team-vs-team comparisons (blue side / red side).
 *  Not the win/loss pair: a side is neither positive nor negative. */
export const CHART_TEAM_BLUE = "hsl(220 80% 60%)";
export const CHART_TEAM_RED = "hsl(0 80% 60%)";
