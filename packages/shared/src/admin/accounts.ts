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

export interface AdminSteamAccount {
  steamId64: string;
  isOwner: boolean;
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

export interface AdminSteamAccountDeleteResult {
  steamId64: string;
}
