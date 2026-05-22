export interface MatchNarrativeHighlightReel {
  /** 1v1 takedowns where the opponent had no allies in range */
  soloKills: number;
  /** Takedowns while the owner's side had fewer participants nearby */
  outnumberedKills: number;
  /** Games the owner survived a sub-10 HP moment (a "clutch survival") */
  survivedSingleDigitHpCount: number;
}

export interface MatchNarrativeWindow {
  /** Matches the server resolved owner extras for (subset of requested IDs) */
  matchCount: number;
  /** Matches dropped because they're remakes (excluded per LoL invariant) */
  remakeCount: number;
  highlightReel: MatchNarrativeHighlightReel;
}

export interface MatchNarrativeMultikills {
  pentaKills: number;
  quadraKills: number;
  tripleKills: number;
  doubleKills: number;
  /** Largest single-life kill streak across the user's history */
  largestKillingSpree: number;
}

export interface MatchNarrativeLifetime {
  /** Total non-remake games the owner played that have a cached detail row */
  matchCount: number;
  multikills: MatchNarrativeMultikills;
}
