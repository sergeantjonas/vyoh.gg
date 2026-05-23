export interface LolAccount {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
}

// Snapshot of the "current state" of a ranked account — written by the
// API's `refreshAccountSummary` at every persistence chokepoint (rank
// snapshot write, match write) and read by the nav-bootstrap query. The
// shape mirrors the Summoner denorm columns but renames `currentRank*`
// to a nested `rank` object so the API response stays readable. `null`
// fields encode three distinct states:
//   - rank: null         — never played a ranked queue
//   - lastPlayedChampionAlias: null — no non-remake match on file
//   - updatedAt: null    — refresh has never run for this account yet
// The UI uses `updatedAt: null` to decide between "show simple row"
// (not yet synced) and "show rich row with missing rank pill" (synced
// but unranked).
export interface LolAccountSummary {
  rank: {
    tier: string;
    division: string;
    leaguePoints: number;
    queueId: string;
  } | null;
  lastPlayedChampionAlias: string | null;
  updatedAt: string | null;
}

// `/me` payload variant — bare `LolAccount` is kept for sync whitelist
// checks inside the API; this extended shape is what crosses the wire.
// `profileIconId` is identity, not "summary state" — it lives at the
// top level so consumers don't have to traverse the nullable summary
// just to render the per-account avatar.
export interface LolAccountWithSummary extends LolAccount {
  profileIconId: number | null;
  summary: LolAccountSummary | null;
}
