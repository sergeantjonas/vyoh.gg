import { Injectable, Logger } from "@nestjs/common";
import type {
  SteamLibrarySummary,
  SteamOwnedGames,
  SteamPlatform,
  SteamPlatformMix,
} from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SteamAchievementSchemaService } from "./achievement-schema.service";
import { SteamEnrichmentService } from "./enrichment.service";
import { SteamGlobalRarityService } from "./global-rarity.service";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";
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
    private readonly client: SteamClientService,
    private readonly enrichment: SteamEnrichmentService,
    private readonly achievementSchema: SteamAchievementSchemaService,
    private readonly playerUnlocks: SteamPlayerUnlocksService,
    private readonly globalRarity: SteamGlobalRarityService
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
      // rtimeLastPlayed mirrors GetOwnedGames' epoch — Steam emits 0 for
      // never-launched, so we narrow to `> 0` and keep the column null
      // until the owner actually starts the game.
      for (const game of games) {
        const rtimeLastPlayed =
          game.rtime_last_played && game.rtime_last_played > 0
            ? new Date(game.rtime_last_played * 1000)
            : null;
        await tx.steamOwnedGame.upsert({
          where: { appid: game.appid },
          create: { appid: game.appid, name: game.name, rtimeLastPlayed },
          update: {
            name: game.name,
            lastSeenAt: now,
            removedAt: null,
            rtimeLastPlayed,
          },
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

    // Enrich newly-added titles so their hashed-asset paths are available
    // immediately. Reappeared rows already have an enrichment row from when
    // they were first seen — only `added` needs the bootstrap call. Failure
    // here is non-fatal: the monthly cron + on-boot backfill both reconcile.
    if (diff.added.length > 0) {
      try {
        await this.enrichment.enrichApps(diff.added);
      } catch (err) {
        this.logger.warn(`enrichment of newly-added apps failed: ${err}`);
      }
      // Same pattern for the achievement schema — newly-added games get their
      // schema fetched in the same sync tick so the per-game panel can render
      // immediately rather than waiting up to a month for the schema cron.
      try {
        await this.achievementSchema.refreshSchemas(diff.added);
      } catch (err) {
        this.logger.warn(
          `achievement-schema bootstrap of newly-added apps failed: ${err}`
        );
      }
      // Pull initial unlocks for newly-added games that turned out to have an
      // achievement schema. Must run after the schema bootstrap above — the
      // `SteamPlayerUnlock` FK references `SteamGameAchievement(appid, apiName)`,
      // so the schema rows have to exist first. Filtering on `achievementCount`
      // also skips schema-less games (CS2, demos) cleanly.
      const withSchema = await this.prisma.steamGameAchievementMeta.findMany({
        where: { appid: { in: diff.added }, achievementCount: { gt: 0 } },
        select: { appid: true },
      });
      if (withSchema.length > 0) {
        const eligibleAppids = withSchema.map((m) => m.appid);
        try {
          await this.playerUnlocks.syncUnlocks(eligibleAppids);
        } catch (err) {
          this.logger.warn(`unlock bootstrap of newly-added apps failed: ${err}`);
        }
        // Rarity bootstrap — same eligibility set. Weekly cron would otherwise
        // delay the badge data for a freshly-added game by up to a week.
        try {
          await this.globalRarity.refreshRarity(eligibleAppids);
        } catch (err) {
          this.logger.warn(`rarity bootstrap of newly-added apps failed: ${err}`);
        }
      }
    }

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

  // Owned-games drill-in: every currently-owned game with its lifetime +
  // 2-week playtime from the latest snapshot, sorted by lifetime descending.
  // Refunded titles (removedAt IS NOT NULL) are excluded — they survive in
  // the table for historical playtime sums but don't belong on a "what you
  // own" surface. Joined with SteamOwnedGame so we have a stable name even
  // if Steam ever drops a row from the latest snapshot.
  async getOwnedGames(): Promise<SteamOwnedGames> {
    const latest = await this.prisma.steamPlaytimeSnapshot.findFirst({
      select: { snapshotDate: true },
      orderBy: { snapshotDate: "desc" },
    });

    if (latest === null) {
      return { games: [], lastSyncedAt: null };
    }

    const rows = await this.prisma.steamPlaytimeSnapshot.findMany({
      where: { snapshotDate: latest.snapshotDate, game: { removedAt: null } },
      select: {
        appid: true,
        playtimeForeverMinutes: true,
        playtime2WeeksMinutes: true,
        game: {
          select: {
            name: true,
            rtimeLastPlayed: true,
            // Left-join: rows without an enrichment row (e.g. delisted, or
            // before the monthly cron reached them) come back as `null` and
            // map to the per-field nulls below — image helpers fall back to
            // legacy unhashed paths.
            enrichment: {
              select: {
                assetUrlFormat: true,
                assetTimestamp: true,
                libraryCapsulePath: true,
                libraryCapsule2xPath: true,
                libraryHeroPath: true,
                libraryHero2xPath: true,
                headerPath: true,
                heroCapsulePath: true,
                logoPath: true,
                appType: true,
                tagIds: true,
              },
            },
          },
        },
      },
      orderBy: { playtimeForeverMinutes: "desc" },
    });

    return {
      games: rows.map((r) => {
        const e = r.game.enrichment;
        return {
          appid: r.appid,
          name: r.game.name,
          playtimeForeverMinutes: r.playtimeForeverMinutes,
          playtime2WeeksMinutes: r.playtime2WeeksMinutes,
          assetUrlFormat: e?.assetUrlFormat ?? null,
          // BigInt over the wire would force JSON.stringify(bigint) handling
          // everywhere downstream. Steam's epoch fits well inside Number's
          // safe range — narrow at the boundary.
          assetTimestamp: e?.assetTimestamp != null ? Number(e.assetTimestamp) : null,
          libraryCapsulePath: e?.libraryCapsulePath ?? null,
          libraryCapsule2xPath: e?.libraryCapsule2xPath ?? null,
          libraryHeroPath: e?.libraryHeroPath ?? null,
          libraryHero2xPath: e?.libraryHero2xPath ?? null,
          headerPath: e?.headerPath ?? null,
          heroCapsulePath: e?.heroCapsulePath ?? null,
          logoPath: e?.logoPath ?? null,
          appType: e?.appType ?? null,
          tagIds: e?.tagIds ?? [],
          rtimeLastPlayedAt: r.game.rtimeLastPlayed?.toISOString() ?? null,
        };
      }),
      lastSyncedAt: latest.snapshotDate.toISOString(),
    };
  }
}
