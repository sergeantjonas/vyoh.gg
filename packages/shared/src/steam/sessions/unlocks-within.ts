// Which unlocks belong to a session. Steam stamps each achievement with its
// own `unlocktime`, and a session is the interval between the first presence
// tick that saw the game and the last one that did — so the join is a plain
// time-window check, plus slack at both ends for what the ticks cannot see.

/**
 * `endedAt` is the last tick that still showed the game, not the moment it
 * closed, so an achievement popped in the final minutes lands after it by up
 * to one poll interval. The same holds in mirror at `startedAt`. Two polls'
 * worth covers a tick the poller skipped.
 *
 * Measured against the local table on 2026-09-14: shifting `unlockedAt` by
 * ±1 h or ±2 h only lowered the match count, so the slack is covering poll
 * granularity and nothing else.
 */
export const SESSION_UNLOCK_SLACK_MS = 4 * 60 * 1000;

export interface SessionInterval {
  appid: number;
  startedAt: Date;
  endedAt: Date;
}

export interface UnlockInstant {
  appid: number;
  unlockedAt: Date;
}

export function isUnlockWithin(session: SessionInterval, unlock: UnlockInstant): boolean {
  if (unlock.appid !== session.appid) return false;
  const t = unlock.unlockedAt.getTime();
  return (
    t >= session.startedAt.getTime() - SESSION_UNLOCK_SLACK_MS &&
    t <= session.endedAt.getTime() + SESSION_UNLOCK_SLACK_MS
  );
}

/** Unlocks inside the session's window, in unlock order. */
export function unlocksWithin<U extends UnlockInstant>(
  session: SessionInterval,
  unlocks: readonly U[]
): U[] {
  return unlocks
    .filter((u) => isUnlockWithin(session, u))
    .sort((a, b) => a.unlockedAt.getTime() - b.unlockedAt.getTime());
}

/**
 * Unlocks no session in the list can claim — the off-camera ledger. An
 * unlock is claimed by any session whose window (with slack) contains it, so
 * two sessions that abut can both claim an unlock in the seam; that is fine
 * for the ledger, which only needs to know it was seen at all.
 */
export function unlocksOffCamera<U extends UnlockInstant>(
  sessions: readonly SessionInterval[],
  unlocks: readonly U[]
): U[] {
  const byApp = new Map<number, SessionInterval[]>();
  for (const s of sessions) {
    const list = byApp.get(s.appid);
    if (list) list.push(s);
    else byApp.set(s.appid, [s]);
  }
  return unlocks.filter((u) => {
    const candidates = byApp.get(u.appid);
    return !candidates?.some((s) => isUnlockWithin(s, u));
  });
}
