import { Injectable, Logger } from "@nestjs/common";
import type { SteamLibrarySummary, SteamPlatform, SteamPlatformMix } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";
import type { SteamOwnedGameRaw } from "./types";

export interface OwnedGamesDiff {
  added: number[];
  persisted: number[];
  reappeared: number[];
  removed: number[];
}

// Pure diff against the previously-tracked set. Split out so the test suite can
// exercise the bookkeeping without a Prisma fixture — the I/O wrapper in
// syncOwnedGames stays a thin shell over this + four upserts.
export function diffOwnedGames(
  current: SteamOwnedGameRaw[],
  previous: Array<{ appid: number; removedAt: Date | null }>
): OwnedGamesDiff {
  const currentSet = new Set(current.map((g) => g.appid));
  const previousMap = new Map(previous.map((p) => [p.appid, p.removedAt]));

  const added: number[] = [];
  const persisted: number[] = [];
  const reappeared: number[] = [];
  for (const game of current) {
    const prev = previousMap.get(game.appid);
    if (prev === undefined) {
      added.push(game.appid);
    } else if (prev !== null) {
      reappeared.push(game.appid);
    } else {
      persisted.push(game.appid);
    }
  }

  const removed: number[] = [];
  for (const [appid, removedAt] of previousMap) {
    if (!currentSet.has(appid) && removedAt === null) {
      removed.push(appid);
    }
  }

  return { added, persisted, reappeared, removed };
}

// Steam's `snapshotDate` is the owner's local day, not UTC — the cron fires at
// 04:00 Europe/Brussels so the bucket reads as "the day the poll covered".
// We store a Date with the local Y-M-D at UTC midnight; Prisma's @db.Date
// normalizes the time part either way, but constructing it this way keeps
// dev-side reads in Europe/Brussels from drifting a day around DST seams.
function localDateBucket(now: Date, timeZone: string): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(now);
  return new Date(`${ymd}T00:00:00Z`);
}

@Injectable()
export class SteamOwnedGamesService {
  private readonly logger = new Logger(SteamOwnedGamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService
  ) {}

  async syncOwnedGames(now: Date = new Date()): Promise<OwnedGamesDiff> {
    const start = Date.now();
    const games = await this.client.getOwnedGames(STEAM_OWNER_ID);
    const previous = await this.prisma.steamOwnedGame.findMany({
      select: { appid: true, removedAt: true },
    });
    const diff = diffOwnedGames(games, previous);
    const snapshotDate = localDateBucket(now, "Europe/Brussels");

    await this.prisma.$transaction(async (tx) => {
      // Upsert each currently-owned game. firstSeenAt is only set on insert
      // (default). lastSeenAt advances on every poll. removedAt clears for
      // games that came back (e.g. unhidden, refunded-and-rebought).
      for (const game of games) {
        await tx.steamOwnedGame.upsert({
          where: { appid: game.appid },
          create: { appid: game.appid, name: game.name },
          update: { name: game.name, lastSeenAt: now, removedAt: null },
        });
      }

      if (diff.removed.length > 0) {
        await tx.steamOwnedGame.updateMany({
          where: { appid: { in: diff.removed } },
          data: { removedAt: now },
        });
      }

      // Upsert snapshots — composite (appid, snapshotDate) PK makes a same-day
      // re-run idempotent. Manual retries and the next-day cron both behave.
      for (const game of games) {
        await tx.steamPlaytimeSnapshot.upsert({
          where: {
            appid_snapshotDate: { appid: game.appid, snapshotDate },
          },
          create: {
            appid: game.appid,
            snapshotDate,
            playtimeForeverMinutes: game.playtime_forever,
            playtime2WeeksMinutes: game.playtime_2weeks ?? null,
            playtimeWindowsMinutes: game.playtime_windows_forever ?? null,
            playtimeMacMinutes: game.playtime_mac_forever ?? null,
            playtimeLinuxMinutes: game.playtime_linux_forever ?? null,
            playtimeDeckMinutes: game.playtime_deck_forever ?? null,
          },
          update: {
            playtimeForeverMinutes: game.playtime_forever,
            playtime2WeeksMinutes: game.playtime_2weeks ?? null,
            playtimeWindowsMinutes: game.playtime_windows_forever ?? null,
            playtimeMacMinutes: game.playtime_mac_forever ?? null,
            playtimeLinuxMinutes: game.playtime_linux_forever ?? null,
            playtimeDeckMinutes: game.playtime_deck_forever ?? null,
          },
        });
      }
    });

    const duration = Date.now() - start;
    this.logger.log(
      `synced ${games.length} games (added=${diff.added.length} reappeared=${diff.reappeared.length} removed=${diff.removed.length}) in ${duration}ms`
    );

    return diff;
  }

  // Catalog snapshot read from the local tables — no Steam API call. The poller
  // is the only writer; this is the read side. `everLaunchedCount` is derived
  // from the most-recent snapshotDate (not the row's all-time max) so that a
  // game whose playtime resets via family-share / refund-and-rebuy is counted
  // honestly against the current state.
  async getLibrarySummary(): Promise<SteamLibrarySummary> {
    const ownedCount = await this.prisma.steamOwnedGame.count({
      where: { removedAt: null },
    });

    const latest = await this.prisma.steamPlaytimeSnapshot.findFirst({
      select: { snapshotDate: true },
      orderBy: { snapshotDate: "desc" },
    });

    if (latest === null) {
      return {
        ownedCount,
        everLaunchedCount: 0,
        untouchedCount: ownedCount,
        lastSyncedAt: null,
      };
    }

    // Count played titles among currently-owned games on the most recent
    // snapshot date. Joining via owned-games' removedAt keeps refunded titles
    // out of the "ever launched" count even if a stale snapshot row exists.
    const everLaunchedCount = await this.prisma.steamPlaytimeSnapshot.count({
      where: {
        snapshotDate: latest.snapshotDate,
        playtimeForeverMinutes: { gt: 0 },
        game: { removedAt: null },
      },
    });

    return {
      ownedCount,
      everLaunchedCount,
      untouchedCount: Math.max(0, ownedCount - everLaunchedCount),
      lastSyncedAt: latest.snapshotDate.toISOString(),
    };
  }

  // Platform breakdown summed from the latest snapshot, scoped to
  // currently-owned games (joined removedAt IS NULL). Steam's per-OS counters
  // are cumulative, so summing them gives total cross-platform minutes — not
  // necessarily equal to playtime_forever for very old titles where Steam
  // never backfilled per-OS data.
  async getPlatformMix(): Promise<SteamPlatformMix> {
    const latest = await this.prisma.steamPlaytimeSnapshot.findFirst({
      select: { snapshotDate: true },
      orderBy: { snapshotDate: "desc" },
    });

    if (latest === null) {
      return {
        totalMinutes: 0,
        windowsMinutes: 0,
        macMinutes: 0,
        linuxMinutes: 0,
        deckMinutes: 0,
        dominantPlatform: null,
        lastSyncedAt: null,
      };
    }

    const totals = await this.prisma.steamPlaytimeSnapshot.aggregate({
      where: { snapshotDate: latest.snapshotDate, game: { removedAt: null } },
      _sum: {
        playtimeWindowsMinutes: true,
        playtimeMacMinutes: true,
        playtimeLinuxMinutes: true,
        playtimeDeckMinutes: true,
      },
    });

    const windowsMinutes = totals._sum.playtimeWindowsMinutes ?? 0;
    const macMinutes = totals._sum.playtimeMacMinutes ?? 0;
    const linuxMinutes = totals._sum.playtimeLinuxMinutes ?? 0;
    const deckMinutes = totals._sum.playtimeDeckMinutes ?? 0;
    const totalMinutes = windowsMinutes + macMinutes + linuxMinutes + deckMinutes;

    const entries: Array<[SteamPlatform, number]> = [
      ["windows", windowsMinutes],
      ["mac", macMinutes],
      ["linux", linuxMinutes],
      ["deck", deckMinutes],
    ];
    const dominantPlatform =
      totalMinutes === 0 ? null : entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];

    return {
      totalMinutes,
      windowsMinutes,
      macMinutes,
      linuxMinutes,
      deckMinutes,
      dominantPlatform,
      lastSyncedAt: latest.snapshotDate.toISOString(),
    };
  }
}
