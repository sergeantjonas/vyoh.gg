import { Injectable } from "@nestjs/common";
import type {
  HomeFirstPlayed,
  HomeFirstPlayedLol,
  HomeFirstPlayedSteam,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

const WINDOW_DAYS = 30;
const STEAM_THRESHOLD_MINUTES = 30;

export interface LolMatchRow {
  champion: string;
  playedAt: Date;
  win: boolean;
}

export interface SteamSnapshotRow {
  appid: number;
  name: string;
  snapshotDate: Date;
  playtimeForeverMinutes: number;
}

/**
 * Most-recently first-played LoL champion within the window, with aggregate
 * sample so the tile can render "N matches (W-L)". Returns null when no
 * champion's first non-remake match falls inside the window.
 */
export function detectFirstLolChampion(
  matches: LolMatchRow[],
  asOf: Date,
  windowDays: number
): HomeFirstPlayedLol | null {
  const byChampion = new Map<
    string,
    { firstPlayedAt: Date; matchCount: number; wins: number }
  >();

  for (const m of matches) {
    const entry = byChampion.get(m.champion);
    if (!entry) {
      byChampion.set(m.champion, {
        firstPlayedAt: m.playedAt,
        matchCount: 1,
        wins: m.win ? 1 : 0,
      });
      continue;
    }
    entry.matchCount += 1;
    if (m.win) entry.wins += 1;
    if (m.playedAt < entry.firstPlayedAt) entry.firstPlayedAt = m.playedAt;
  }

  const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);
  let best: {
    champion: string;
    firstPlayedAt: Date;
    matchCount: number;
    wins: number;
  } | null = null;
  for (const [champion, entry] of byChampion) {
    if (entry.firstPlayedAt < windowStart) continue;
    if (!best || entry.firstPlayedAt > best.firstPlayedAt) {
      best = { champion, ...entry };
    }
  }
  if (!best) return null;
  return {
    kind: "lol",
    champion: best.champion,
    firstPlayedAt: best.firstPlayedAt.toISOString(),
    matchCount: best.matchCount,
    wins: best.wins,
  };
}

/**
 * Most-recently first-crossed Steam appid within the window. An appid
 * "crosses" the threshold the first time its `playtimeForeverMinutes` ≥
 * `thresholdMinutes` *after* an earlier snapshot was < `thresholdMinutes`.
 * Appids with no pre-threshold baseline (their first observed snapshot
 * was already ≥ threshold) are excluded — same discipline as S8.4: the
 * true first-played moment predates our tracking, so the lower bound is
 * unknown.
 */
export function detectFirstSteamCrossing(
  snapshots: SteamSnapshotRow[],
  asOf: Date,
  windowDays: number,
  thresholdMinutes: number
): HomeFirstPlayedSteam | null {
  const byAppid = new Map<number, SteamSnapshotRow[]>();
  for (const row of snapshots) {
    const arr = byAppid.get(row.appid);
    if (arr) arr.push(row);
    else byAppid.set(row.appid, [row]);
  }

  const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);
  let best: {
    appid: number;
    name: string;
    firstPlayedAt: Date;
    totalMinutes: number;
  } | null = null;

  for (const [appid, rows] of byAppid) {
    rows.sort((a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime());
    let sawBelow = false;
    let crossing: SteamSnapshotRow | null = null;
    for (const row of rows) {
      if (row.playtimeForeverMinutes < thresholdMinutes) {
        sawBelow = true;
        continue;
      }
      if (sawBelow) {
        crossing = row;
        break;
      }
    }
    if (!crossing) continue;
    if (crossing.snapshotDate < windowStart) continue;
    const latest = rows[rows.length - 1];
    if (!latest) continue;
    if (!best || crossing.snapshotDate > best.firstPlayedAt) {
      best = {
        appid,
        name: crossing.name,
        firstPlayedAt: crossing.snapshotDate,
        totalMinutes: latest.playtimeForeverMinutes,
      };
    }
  }

  if (!best) return null;
  return {
    kind: "steam",
    appid: best.appid,
    name: best.name,
    firstPlayedAt: best.firstPlayedAt.toISOString(),
    totalMinutes: best.totalMinutes,
  };
}

/**
 * Pick the more-recent of two candidate events. Both nullable; falls back
 * to the non-null one when only one exists; returns null when both null.
 */
export function pickMostRecent(
  lol: HomeFirstPlayedLol | null,
  steam: HomeFirstPlayedSteam | null
): HomeFirstPlayedLol | HomeFirstPlayedSteam | null {
  if (!lol) return steam;
  if (!steam) return lol;
  return new Date(lol.firstPlayedAt) >= new Date(steam.firstPlayedAt) ? lol : steam;
}

@Injectable()
export class HomeFirstPlayedService {
  constructor(private readonly prisma: PrismaService) {}

  async getFirstPlayed(): Promise<HomeFirstPlayed> {
    const asOf = new Date();
    const [matchRows, snapshotRows] = await Promise.all([
      this.prisma.match.findMany({
        where: { remake: false },
        select: { champion: true, playedAt: true, win: true },
      }),
      this.prisma.steamPlaytimeSnapshot.findMany({
        select: {
          appid: true,
          snapshotDate: true,
          playtimeForeverMinutes: true,
          game: { select: { name: true } },
        },
      }),
    ]);

    const lol = detectFirstLolChampion(matchRows, asOf, WINDOW_DAYS);
    const steam = detectFirstSteamCrossing(
      snapshotRows.map((r) => ({
        appid: r.appid,
        name: r.game.name,
        snapshotDate: r.snapshotDate,
        playtimeForeverMinutes: r.playtimeForeverMinutes,
      })),
      asOf,
      WINDOW_DAYS,
      STEAM_THRESHOLD_MINUTES
    );

    const winner = pickMostRecent(lol, steam);
    if (winner) return winner;
    return { kind: "none", windowDays: WINDOW_DAYS };
  }
}
