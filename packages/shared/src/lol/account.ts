export interface LolAccount {
  slug: string;
  gameName: string;
  tagLine: string;
  region: string;
  // The roster doubles as the API's sync whitelist (test accounts pull
  // real match data for parity checks) and as the recap arc's data source.
  // These flags split the two roles without forking the list: anything the
  // recap reads is `isOwner: true`; everything else still syncs and is
  // available on `/lol/$accountSlug/...` for inspection.
  //
  // Default-deny: omit the flag → not an owner account → excluded from any
  // surface that wants only the owner's data.
  isOwner?: boolean;
  // Exactly one owner account should carry `isPrimary: true`. Drives the
  // Ahri subject chapter and any "main account" framing on `/`. Asserted on
  // every roster write — see `assertAccountOwnerInvariants`.
  isPrimary?: boolean;
  // Hidden accounts are dropped from the nav but keep serving every route
  // they always did — hiding removes the link, not the page. Which is why
  // this is a flag on the payload rather than an omission from it: the web
  // resolves a route's own account object out of `/me`, so a missing row
  // breaks the very pages that are meant to stay reachable.
  //
  // The paired `syncPausedAt` column deliberately has no counterpart here.
  // Whether an account is still being fetched is an ops concern with no
  // bearing on what a visitor sees, so it stays inside the API.
  hidden?: boolean;
}

export function isHiddenAccount(account: LolAccount): boolean {
  return account.hidden === true;
}

export function getVisibleAccounts<T extends LolAccount>(accounts: T[]): T[] {
  return accounts.filter((a) => !isHiddenAccount(a));
}

export function isOwnerAccount(account: LolAccount): boolean {
  return account.isOwner === true;
}

export function getOwnerAccounts<T extends LolAccount>(accounts: T[]): T[] {
  return accounts.filter(isOwnerAccount);
}

export function getPrimaryAccount<T extends LolAccount>(accounts: T[]): T | null {
  return accounts.find((a) => a.isPrimary === true) ?? null;
}

// Domain invariants for the owner/primary flags. Called before every roster
// write so a malformed roster is rejected at the boundary instead of silently
// producing an empty recap or a wrong-account "main" subject chapter.
export function assertAccountOwnerInvariants(accounts: LolAccount[]): void {
  const owners = accounts.filter(isOwnerAccount);
  const primaries = accounts.filter((a) => a.isPrimary === true);
  if (primaries.length > 1) {
    const slugs = primaries.map((a) => a.slug).join(", ");
    throw new Error(
      `Multiple accounts flagged isPrimary: ${slugs}. Exactly one owner account may be primary.`
    );
  }
  if (owners.length > 0 && primaries.length === 0) {
    throw new Error(
      "At least one owner account exists but none is flagged isPrimary. Exactly one owner account must be primary."
    );
  }
  for (const p of primaries) {
    if (!isOwnerAccount(p)) {
      throw new Error(
        `Account "${p.slug}" is flagged isPrimary without isOwner. Primary accounts must also be owner accounts.`
      );
    }
  }
}

// The primary account is the subject of `/` — it supplies the OG image and the
// nav's default lens — so hiding it yields a roster whose front page is built
// around an account the nav cannot reach.
//
// "At least one owner account stays visible" needs no check of its own: it
// follows from this one plus `assertAccountOwnerInvariants`, which already
// requires a primary whenever any owner exists and requires that primary to be
// an owner. Run both and a fully-hidden owner set is unreachable.
export function assertAccountVisibilityInvariants(accounts: LolAccount[]): void {
  for (const p of accounts.filter((a) => a.isPrimary === true)) {
    if (isHiddenAccount(p)) {
      throw new Error(
        `Account "${p.slug}" is flagged isPrimary and hidden. The primary account is the subject of the landing page and must stay visible.`
      );
    }
  }
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
