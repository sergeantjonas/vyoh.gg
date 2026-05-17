import { Injectable } from "@nestjs/common";
import type {
  HomeFirstPlayed,
  HomeFirstPlayedLol,
  HomeFirstPlayedSteam,
} from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";

const WINDOW_DAYS = 30;
const STEAM_THRESHOLD_MINUTES = 30;

export interface LolMatchRow {
  matchId: string;
  champion: string;
  playedAt: Date;
  win: boolean;
  puuid: string;
}

export interface SteamSnapshotRow {
  appid: number;
  name: string;
  snapshotDate: Date;
  playtimeForeverMinutes: number;
}

export interface DetectedFirstLolChampion {
  champion: string;
  firstPlayedAt: Date;
  matchCount: number;
  wins: number;
  /** puuid of the *first* match — used to resolve which account's slug to link. */
  firstPuuid: string;
  /** matchId of the *first* match — drives the match-detail link target. */
  firstMatchId: string;
}

/**
 * Most-recently first-played LoL champion within the window, with aggregate
 * sample so the tile can render "N matches (W-L)". Returns null when no
 * champion's first non-remake match falls inside the window. Tracks the
 * puuid of the earliest match per champion so the caller can resolve the
 * correct account slug for the link.
 */
export function detectFirstLolChampion(
  matches: LolMatchRow[],
  asOf: Date,
  windowDays: number
): DetectedFirstLolChampion | null {
  const byChampion = new Map<
    string,
    {
      firstPlayedAt: Date;
      firstPuuid: string;
      firstMatchId: string;
      matchCount: number;
      wins: number;
    }
  >();

  for (const m of matches) {
    const entry = byChampion.get(m.champion);
    if (!entry) {
      byChampion.set(m.champion, {
        firstPlayedAt: m.playedAt,
        firstPuuid: m.puuid,
        firstMatchId: m.matchId,
        matchCount: 1,
        wins: m.win ? 1 : 0,
      });
      continue;
    }
    entry.matchCount += 1;
    if (m.win) entry.wins += 1;
    if (m.playedAt < entry.firstPlayedAt) {
      entry.firstPlayedAt = m.playedAt;
      entry.firstPuuid = m.puuid;
      entry.firstMatchId = m.matchId;
    }
  }

  const windowStart = new Date(asOf.getTime() - windowDays * 24 * 60 * 60 * 1000);
  let best: DetectedFirstLolChampion | null = null;
  for (const [champion, entry] of byChampion) {
    if (entry.firstPlayedAt < windowStart) continue;
    if (!best || entry.firstPlayedAt > best.firstPlayedAt) {
      best = { champion, ...entry };
    }
  }
  return best;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService
  ) {}

  async getFirstPlayed(): Promise<HomeFirstPlayed> {
    const asOf = new Date();

    // Pre-resolve which summoners back a configured account, so matches owned
    // by orphan/seed puuids (no matching entry in accounts.json) don't compete
    // for the first-played slot — they'd resolve to a null slug and render
    // unlinked, which defeats the tile's purpose.
    const configured = this.identity.getLolAccounts();
    const resolvableSummoners = await this.prisma.summoner.findMany({
      where: {
        OR: configured.map((a) => ({
          gameName: { equals: a.gameName, mode: "insensitive" },
          tagLine: { equals: a.tagLine, mode: "insensitive" },
          region: { equals: a.region, mode: "insensitive" },
        })),
      },
      select: { puuid: true },
    });
    const resolvablePuuids = resolvableSummoners.map((s) => s.puuid);

    const [matchRows, snapshotRows] = await Promise.all([
      this.prisma.match.findMany({
        where: { remake: false, puuid: { in: resolvablePuuids } },
        select: {
          matchId: true,
          champion: true,
          playedAt: true,
          win: true,
          puuid: true,
        },
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

    const detected = detectFirstLolChampion(matchRows, asOf, WINDOW_DAYS);
    const lol = detected ? await this.toLolDto(detected) : null;

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

  private async toLolDto(
    detected: DetectedFirstLolChampion
  ): Promise<HomeFirstPlayedLol> {
    const summoner = await this.prisma.summoner.findUnique({
      where: { puuid: detected.firstPuuid },
      select: { gameName: true, tagLine: true, region: true },
    });
    const accountSlug = summoner
      ? (this.identity
          .getLolAccounts()
          .find(
            (a) =>
              a.gameName.toLowerCase() === summoner.gameName.toLowerCase() &&
              a.tagLine.toLowerCase() === summoner.tagLine.toLowerCase() &&
              a.region.toLowerCase() === summoner.region.toLowerCase()
          )?.slug ?? null)
      : null;
    return {
      kind: "lol",
      champion: detected.champion,
      firstPlayedAt: detected.firstPlayedAt.toISOString(),
      matchId: detected.firstMatchId,
      matchCount: detected.matchCount,
      wins: detected.wins,
      accountSlug,
    };
  }
}
