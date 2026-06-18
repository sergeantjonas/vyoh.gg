/** Owner's mean share of their team's total for each of three per-game metrics,
 *  across recent non-remake positional (Rift) games — optionally scoped to one
 *  champion. Each share is `owner / team-total`, averaged over the sampled games,
 *  so it sits in `[0, 1]` with `0.2` being an exactly even five-way split.
 *
 *  Share-of-team is the role-fair normalization the radar needs: a support
 *  naturally reads low on damage/CS and high on vision without any external
 *  role baseline, and the same shape is meaningful at both champion and profile
 *  scope (a self-vs-role-median ratio would collapse to ~1 at profile scope).
 *
 *  No damage-taken axis: the lean `MatchDetailCache` projection
 *  (`match-projection.ts`) strips `totalDamageTaken` from non-owner participants,
 *  so a team-share can't be computed (it would always read 100% — the owner is
 *  the only contributor). The three kept metrics are share-correct for everyone. */
export interface DamageProfile {
  /** Non-remake positional games sampled (full-roster teams only). */
  sampleSize: number;
  /** Mean share of team damage dealt to champions. */
  damageShare: number;
  /** Mean share of team vision score. */
  visionShare: number;
  /** Mean share of team CS (minions + neutral monsters). */
  csShare: number;
}
