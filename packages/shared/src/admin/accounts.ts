/**
 * Roster rows as the admin surface sees them — deliberately *not* an extension
 * of `LolAccount`.
 *
 * `LolAccount` is the public projection: it collapses `hiddenAt` to a `hidden`
 * boolean and withholds `syncPausedAt` entirely, because whether an account is
 * still being fetched is an ops concern with no bearing on what a visitor sees.
 * The admin table needs the opposite — the timestamps themselves, so a roster
 * reviewed months later can answer "hidden since when". Extending the public
 * type would carry both representations of the same state on one object and
 * leave the next reader guessing which one is authoritative.
 */
export interface AdminLolAccount {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
  isOwner: boolean;
  isPrimary: boolean;
  hiddenAt: string | null;
  syncPausedAt: string | null;
  createdAt: string;
}

export interface AdminLolAccountDeleteResult {
  slug: string;
  /**
   * Match rows left behind. Removing the roster row is not a data delete: the
   * Riot-ID tuple is the only handle on an account's history, so the rows
   * survive as unreachable data rather than being cleaned up. Reported so the
   * client can say how much was stranded and point at purge.
   */
  matchRows: number;
}

/**
 * Per-table row counts a purge would remove, and roughly how much disk that
 * frees. Both endpoints report the same shape so the dialog can put the
 * estimate it showed next to what actually happened.
 */
export interface AdminPurgeCounts {
  summoners: number;
  matches: number;
  rankSnapshots: number;
  /**
   * Cache rows the orphan sweep removes — matches *this* account holds that no
   * other roster account also played. Not equal to `matches`: a shared game
   * keeps its cache row, because the other account's `Match` row still
   * references it.
   */
  detailCacheRows: number;
  timelineCacheRows: number;
}

export interface AdminPurgePreview extends AdminPurgeCounts {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
  /**
   * Average row size × row count, per table — an estimate, and labelled as one
   * wherever it renders. The exact figure would mean summing `pg_column_size`
   * over every targeted row, which for `MatchTimelineCache` reads ~150 KB of
   * TOASTed JSON per row to answer a question the dialog only needs an order of
   * magnitude for.
   */
  estimatedBytes: number;
}

export interface AdminPurgeResult extends AdminPurgeCounts {
  slug: string;
}
