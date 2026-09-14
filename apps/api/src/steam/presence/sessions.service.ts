import { Injectable } from "@nestjs/common";
import type {
  BeatNeighbour,
  SteamCurationSets,
  SteamLiveSession,
  SteamOffCameraUnlockGroup,
  SteamPlaySessionDigest,
  SteamPlaytimeMilestone,
  SteamSessionGameStrip,
  SteamSessionRecord,
  SteamSessionRecords,
  SteamSessionUnlock,
  SteamSessions,
} from "@vyoh/shared";
import {
  OWNER_TIME_ZONE,
  SESSION_UNLOCK_SLACK_MS,
  buildHourMatrix,
  excludeHiddenGames,
  isHiddenGame,
  localSlot,
  selectLiveSessionBeats,
  selectSessionBeats,
  sessionDurationMinutes,
  unlocksOffCamera,
  unlocksWithin,
  visibleAppidFilter,
} from "@vyoh/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { SESSION_POLL_GAP_MAX_MS } from "./play-sessions.service";

export const SESSIONS_DEFAULT_WEEKS = 12;
export const SESSIONS_MAX_WEEKS = 52;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** A session shorter than this is a poller artefact, not a bounce. */
const BOUNCE_MIN_MINUTES = 2;

interface SessionRow {
  id: string;
  appid: number;
  gameNameSnapshot: string;
  startedAt: Date;
  endedAt: Date;
}

interface UnlockRow {
  appid: number;
  apiName: string;
  unlockedAt: Date;
  achievement: {
    displayName: string;
    description: string;
    iconUrl: string;
    hidden: boolean;
    rarity: { percent: number } | null;
    game: { name: string };
  };
}

interface SnapshotRow {
  appid: number;
  snapshotDate: Date;
  playtimeForeverMinutes: number;
}

// The `/steam/sessions` page in one read. Sessions are `SteamPlaySession`
// rows the presence poller closed, so they exist only where the api was
// running; the unlocks Steam stamped inside a session's window belong to it
// (`unlocksWithin`), and the rest of the window's unlocks are reported as
// off-camera rather than attached to a neighbour.
//
// Viewer scoping follows the hidden-games note: anything that names a game
// — the digests, the strips, the ledger, a neighbour beat — drops hidden
// titles for a visitor, while the aggregates (hour matrix, window count,
// rank denominators, first-observed date) still count them anonymously. So
// the session query runs unfiltered and the projection happens here; the
// unlock query is filtered at the database because every unlock row names
// its game.
@Injectable()
export class SteamSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessions(weeks: number, curation: SteamCurationSets): Promise<SteamSessions> {
    const span = Math.min(Math.max(1, Math.floor(weeks)), SESSIONS_MAX_WEEKS);
    const to = new Date();
    const from = new Date(to.getTime() - span * WEEK_MS);
    const appidFilter = visibleAppidFilter(curation);

    // Every closed session, not only the window's: the rank and return beats
    // read a game's whole history, and the table is small — the poller writes
    // a row per launch, not per tick.
    const allRows: SessionRow[] = (
      await this.prisma.steamPlaySession.findMany({
        where: { endedAt: { not: null } },
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          appid: true,
          gameNameSnapshot: true,
          startedAt: true,
          endedAt: true,
        },
      })
    ).flatMap((r) => (r.endedAt ? [{ ...r, endedAt: r.endedAt }] : []));

    // An open row only means "playing now" while the poller is actually
    // polling: the row closes on the tick that sees the game gone, and no
    // tick comes while the api is down. So the row is live only if the last
    // tick is recent and still saw this game — the same bound the state
    // machine uses to end a session across a gap.
    const [openRow, playerState] = await Promise.all([
      this.prisma.steamPlaySession.findFirst({
        where: { endedAt: null },
        orderBy: { startedAt: "desc" },
        select: { id: true, appid: true, gameNameSnapshot: true, startedAt: true },
      }),
      this.prisma.steamPlayerState.findFirst({
        select: { currentAppid: true, lastPolledAt: true },
      }),
    ]);
    const pollIsFresh =
      playerState !== null &&
      to.getTime() - playerState.lastPolledAt.getTime() <= SESSION_POLL_GAP_MAX_MS;
    const liveRow =
      openRow &&
      pollIsFresh &&
      playerState.currentAppid === openRow.appid &&
      !isHiddenGame(openRow.appid, curation)
        ? openRow
        : null;

    const windowRows = allRows.filter((r) => r.startedAt >= from);
    const visibleWindowRows = excludeHiddenGames(windowRows, curation);
    const windowAppids = [
      ...new Set([
        ...visibleWindowRows.map((r) => r.appid),
        ...(liveRow ? [liveRow.appid] : []),
      ]),
    ];

    const [unlockRows, snapshotRows, totals, unlockedCounts] = await Promise.all([
      this.prisma.steamPlayerUnlock.findMany({
        where: {
          appid: appidFilter,
          unlockedAt: { gte: new Date(from.getTime() - SESSION_UNLOCK_SLACK_MS) },
        },
        orderBy: { unlockedAt: "asc" },
        include: {
          achievement: {
            select: {
              displayName: true,
              description: true,
              iconUrl: true,
              hidden: true,
              rarity: { select: { percent: true } },
              game: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.steamPlaytimeSnapshot.findMany({
        where: { appid: { in: windowAppids }, snapshotDate: { gte: from } },
        orderBy: { snapshotDate: "asc" },
        select: { appid: true, snapshotDate: true, playtimeForeverMinutes: true },
      }),
      this.prisma.steamGameAchievement.groupBy({
        by: ["appid"],
        where: { appid: { in: windowAppids } },
        _count: { apiName: true },
      }),
      this.prisma.steamPlayerUnlock.groupBy({
        by: ["appid"],
        where: { appid: { in: windowAppids } },
        _count: { apiName: true },
      }),
    ]);

    const totalByApp = new Map(totals.map((t) => [t.appid, t._count.apiName]));
    const unlockedByApp = new Map(unlockedCounts.map((t) => [t.appid, t._count.apiName]));
    const byGame = groupBy(allRows, (r) => r.appid);
    const hourMatrix = buildHourMatrix(windowRows, OWNER_TIME_ZONE);

    const digests: SteamPlaySessionDigest[] = [];
    const milestones: SteamPlaytimeMilestone[] = [];
    const unlockTicksByApp = new Map<number, string[]>();

    for (const [index, row] of allRows.entries()) {
      if (row.startedAt < from || isHiddenGame(row.appid, curation)) continue;
      const unlocks = unlocksWithin(row, unlockRows);
      const total = totalByApp.get(row.appid) ?? 0;
      const beats = selectSessionBeats({
        session: row,
        gameSessions: byGame.get(row.appid) ?? [row],
        windowSessions: windowRows,
        before: neighbour(allRows[index - 1], curation),
        after: neighbour(allRows[index + 1], curation),
        playtimeForeverMinutes: playtimeAfter(
          snapshotRows,
          row,
          byGame.get(row.appid) ?? []
        ),
        completion:
          total > 0 ? { total, unlocked: unlockedByApp.get(row.appid) ?? 0 } : null,
        unlocks: unlocks.map((u) => ({
          unlockedAt: u.unlockedAt,
          globalPercent: u.achievement.rarity?.percent ?? null,
        })),
        hourMatrix,
        timeZone: OWNER_TIME_ZONE,
      });
      const digest: SteamPlaySessionDigest = {
        id: row.id,
        game: { appid: row.appid, name: row.gameNameSnapshot },
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt.toISOString(),
        durationMinutes: sessionDurationMinutes(row),
        beats,
        unlocks: unlocks.map(toUnlock),
      };
      digests.push(digest);
      for (const b of beats) {
        if (b.kind === "milestone") {
          milestones.push({
            game: digest.game,
            hours: b.hours,
            sessionId: row.id,
            crossedAt: digest.endedAt,
          });
        }
      }
      const ticks = unlockTicksByApp.get(row.appid) ?? [];
      for (const u of unlocks) ticks.push(u.unlockedAt.toISOString());
      unlockTicksByApp.set(row.appid, ticks);
    }
    digests.reverse();
    milestones.reverse();

    let live: SteamLiveSession | null = null;
    if (liveRow) {
      const running: SessionRow = { ...liveRow, endedAt: to };
      const total = totalByApp.get(liveRow.appid) ?? 0;
      const last = allRows[allRows.length - 1];
      live = {
        id: liveRow.id,
        game: { appid: liveRow.appid, name: liveRow.gameNameSnapshot },
        startedAt: liveRow.startedAt.toISOString(),
        beats: selectLiveSessionBeats({
          session: running,
          gameSessions: [...(byGame.get(liveRow.appid) ?? []), running],
          windowSessions: [...windowRows, running],
          before:
            last && last.endedAt <= liveRow.startedAt ? neighbour(last, curation) : null,
          after: null,
          playtimeForeverMinutes: null,
          completion:
            total > 0 ? { total, unlocked: unlockedByApp.get(liveRow.appid) ?? 0 } : null,
          unlocks: [],
          // The slot beats subtract the session's own minutes from its start
          // cell, so the matrix they read has to contain it; the published
          // matrix stays closed-sessions-only.
          hourMatrix: buildHourMatrix([...windowRows, running], OWNER_TIME_ZONE),
          timeZone: OWNER_TIME_ZONE,
        }),
      };
    }

    const first = allRows[0];
    return {
      window: {
        from: from.toISOString(),
        to: to.toISOString(),
        observedSince: first ? first.startedAt.toISOString() : null,
        sessionCount: windowRows.length,
      },
      live,
      sessions: digests,
      hourMatrix,
      timeZone: OWNER_TIME_ZONE,
      perGame: perGameStrips(visibleWindowRows, unlockTicksByApp),
      milestones,
      records: records(digests, totalByApp),
      offCamera: offCameraGroups(
        unlocksOffCamera(allRows, unlockRows).filter((u) => u.unlockedAt >= from),
        allRows
      ),
    };
  }
}

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

// A hidden neighbour would put its name in a `bounced-from` / `moved-on-to`
// beat, so for a visitor it is simply not there.
function neighbour(
  row: SessionRow | undefined,
  curation: SteamCurationSets
): BeatNeighbour | null {
  return row && !isHiddenGame(row.appid, curation)
    ? {
        appid: row.appid,
        name: row.gameNameSnapshot,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
      }
    : null;
}

// The lifetime counter as it stood when this session closed: the first daily
// snapshot dated after the session, minus any later sessions of the same game
// that the snapshot had already counted in. Without the subtraction, an early
// session in a busy week would carry every milestone the week crossed.
//
// A snapshot row is keyed by owner-local calendar day and rewritten every
// quarter hour, so the row for day D holds playtime through the end of D even
// though it reads back as D at midnight. Both bounds below therefore run to
// the end of the snapshot's day: the row for the day a session ended on is
// the one to read, and every later session up to that day's end is inside
// it. Sessions ending in the last two UTC hours of a day sit just past the
// local row's final write and read the day's row anyway; that can only
// understate the counter, never claim a mark that was not crossed.
function playtimeAfter(
  snapshots: readonly SnapshotRow[],
  session: SessionRow,
  gameSessions: readonly SessionRow[]
): number | null {
  const snapshot = snapshots.find(
    (s) =>
      s.appid === session.appid &&
      s.snapshotDate.getTime() + DAY_MS > session.endedAt.getTime()
  );
  if (!snapshot) return null;
  let later = 0;
  for (const other of gameSessions) {
    if (
      other.startedAt >= session.endedAt &&
      other.startedAt.getTime() < snapshot.snapshotDate.getTime() + DAY_MS
    ) {
      later += sessionDurationMinutes(other);
    }
  }
  return Math.max(0, snapshot.playtimeForeverMinutes - later);
}

function toUnlock(u: UnlockRow): SteamSessionUnlock {
  return {
    apiName: u.apiName,
    displayName: u.achievement.displayName,
    description: u.achievement.description,
    iconUrl: u.achievement.iconUrl || null,
    hidden: u.achievement.hidden,
    unlockedAt: u.unlockedAt.toISOString(),
    globalPercent: u.achievement.rarity?.percent ?? null,
  };
}

function perGameStrips(
  windowRows: readonly SessionRow[],
  unlockTicksByApp: ReadonlyMap<number, string[]>
): SteamSessionGameStrip[] {
  const strips: SteamSessionGameStrip[] = [];
  for (const [appid, rows] of groupBy(windowRows, (r) => r.appid)) {
    const newest = rows[rows.length - 1];
    if (!newest) continue;
    strips.push({
      game: { appid, name: newest.gameNameSnapshot },
      totalMinutes: rows.reduce((sum, r) => sum + sessionDurationMinutes(r), 0),
      sessions: rows.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        durationMinutes: sessionDurationMinutes(r),
      })),
      unlockTicks: unlockTicksByApp.get(appid) ?? [],
    });
  }
  strips.sort((a, b) => b.totalMinutes - a.totalMinutes);
  return strips;
}

function record(d: SteamPlaySessionDigest, value: number): SteamSessionRecord {
  return { sessionId: d.id, game: d.game, startedAt: d.startedAt, value };
}

function maxBy(
  digests: readonly SteamPlaySessionDigest[],
  value: (d: SteamPlaySessionDigest) => number | null
): SteamSessionRecord | null {
  let best: SteamSessionRecord | null = null;
  for (const d of digests) {
    const v = value(d);
    if (v === null) continue;
    if (!best || v > best.value) best = record(d, v);
  }
  return best;
}

function minBy(
  digests: readonly SteamPlaySessionDigest[],
  value: (d: SteamPlaySessionDigest) => number | null
): SteamSessionRecord | null {
  let best: SteamSessionRecord | null = null;
  for (const d of digests) {
    const v = value(d);
    if (v === null) continue;
    if (!best || v < best.value) best = record(d, v);
  }
  return best;
}

// Minutes past the midnight that started the session's local day, so a
// finish after midnight sorts later than one at 23:59 instead of wrapping.
function finishMinutes(d: SteamPlaySessionDigest): number {
  const start = localSlot(new Date(d.startedAt), OWNER_TIME_ZONE);
  const end = localSlot(new Date(d.endedAt), OWNER_TIME_ZONE);
  // Brussels sits on a whole-hour offset, so the UTC minute is the local one.
  const endMinute = new Date(d.endedAt).getUTCMinutes();
  // Clamped: a run longer than a day is a `longest` story, not a late one.
  const daysLater = Math.min(1, (end.weekday - start.weekday + 7) % 7);
  return daysLater * 24 * 60 + end.hour * 60 + endMinute;
}

function records(
  digests: readonly SteamPlaySessionDigest[],
  totalByApp: ReadonlyMap<number, number>
): SteamSessionRecords {
  return {
    longest: maxBy(digests, (d) => d.durationMinutes),
    latestFinish: maxBy(digests, finishMinutes),
    mostUnlocks: maxBy(digests, (d) => (d.unlocks.length > 0 ? d.unlocks.length : null)),
    longestDrySpell: maxBy(digests, (d) =>
      d.unlocks.length === 0 && (totalByApp.get(d.game.appid) ?? 0) > 0
        ? d.durationMinutes
        : null
    ),
    quickestBounce: minBy(digests, (d) =>
      d.durationMinutes >= BOUNCE_MIN_MINUTES ? d.durationMinutes : null
    ),
  };
}

function localDay(at: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: OWNER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function offCameraGroups(
  unlocks: readonly UnlockRow[],
  sessions: readonly SessionRow[]
): SteamOffCameraUnlockGroup[] {
  // Same column the digests name games from, so a retitled game reads one
  // way across the payload; the owned-game name only covers titles never seen
  // in a session at all.
  const nameByApp = new Map<number, string>();
  for (const s of sessions) nameByApp.set(s.appid, s.gameNameSnapshot);
  const groups: SteamOffCameraUnlockGroup[] = [];
  for (const [key, rows] of groupBy(
    unlocks,
    (u) => `${u.appid}:${localDay(u.unlockedAt)}`
  )) {
    const head = rows[0];
    if (!head) continue;
    groups.push({
      game: {
        appid: head.appid,
        name: nameByApp.get(head.appid) ?? head.achievement.game.name,
      },
      day: key.slice(key.indexOf(":") + 1),
      unlocks: rows.map(toUnlock),
    });
  }
  groups.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return groups;
}
