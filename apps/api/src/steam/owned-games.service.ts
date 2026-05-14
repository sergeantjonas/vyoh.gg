import { Injectable, Logger } from "@nestjs/common";
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
          },
          update: {
            playtimeForeverMinutes: game.playtime_forever,
            playtime2WeeksMinutes: game.playtime_2weeks ?? null,
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
}
