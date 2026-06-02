import { Injectable } from "@nestjs/common";
import type { HomeToday } from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { PrismaService } from "../prisma/prisma.service";
import { clipSessionMinutes, startOfLocalDay } from "./home-activity-intensity.service";

const TIME_ZONE = "Europe/Brussels";
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class HomeTodayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService
  ) {}

  async getToday(): Promise<HomeToday> {
    // Owner-filtered — see HomeChronotypeService for rationale. The today
    // chip lives in the conclusion alongside the other owner-only lenses,
    // so non-owner test accounts in accounts.json must not contribute.
    const ownerPuuids = await this.identity.getOwnerPuuids();
    const now = new Date();
    const dayStart = startOfLocalDay(now, TIME_ZONE);
    const last24h = new Date(now.getTime() - DAY_MS);
    const sessionWindowStart = dayStart < last24h ? dayStart : last24h;

    const [matchRows, sessionRows, unlockCount] = await Promise.all([
      this.prisma.match.findMany({
        where: {
          remake: false,
          puuid: { in: ownerPuuids },
          playedAt: { gte: last24h },
        },
        select: { kills: true, deaths: true, assists: true, win: true },
      }),
      this.prisma.steamPlaySession.findMany({
        where: {
          OR: [{ endedAt: null }, { endedAt: { gte: sessionWindowStart } }],
        },
        select: { startedAt: true, endedAt: true },
      }),
      this.prisma.steamPlayerUnlock.count({
        where: { unlockedAt: { gte: last24h } },
      }),
    ]);

    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let lolWins = 0;
    let lolLosses = 0;
    for (const m of matchRows) {
      kills += m.kills;
      deaths += m.deaths;
      assists += m.assists;
      if (m.win) lolWins++;
      else lolLosses++;
    }

    return {
      lolMatches: matchRows.length,
      lolWins,
      lolLosses,
      kills,
      deaths,
      assists,
      steamMinutes: clipSessionMinutes(sessionRows, dayStart, now),
      achievementUnlocks: unlockCount,
      asOf: now.toISOString(),
      timeZone: TIME_ZONE,
    };
  }
}
