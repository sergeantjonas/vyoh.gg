import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { SteamGameRefreshResult, SteamGameRefreshRun } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SteamAchievementSchemaService } from "./achievement-schema.service";
import { SteamEnrichmentService } from "./enrichment.service";
import { SteamGlobalRarityService } from "./global-rarity.service";
import { SteamOwnedGamesService } from "./owned-games.service";
import { SteamPlayerUnlocksService } from "./player-unlocks.service";

const JOB = "steam-game-refresh";

// The owner's per-game "fetch now": every poller's leg for one appid, in the
// order the foreign keys need (schema before unlocks and rarity), reported
// back in the response. One job name covers every appid, so the registry's
// overlap guard refuses a second refresh while one is in flight rather than
// stacking them on the Steam limiter.
@Injectable()
export class SteamGameRefreshService {
  private readonly logger = new Logger(SteamGameRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: SyncJobRegistry,
    private readonly schemas: SteamAchievementSchemaService,
    private readonly unlocks: SteamPlayerUnlocksService,
    private readonly rarity: SteamGlobalRarityService,
    private readonly enrichment: SteamEnrichmentService,
    private readonly ownedGames: SteamOwnedGamesService
  ) {}

  async refresh(appid: number): Promise<SteamGameRefreshResult> {
    const owned = await this.prisma.steamOwnedGame.findUnique({
      where: { appid },
      select: { removedAt: true },
    });
    if (owned === null || owned.removedAt !== null) {
      throw new NotFoundException(`Steam app ${appid} is not in the tracked library.`);
    }
    const outcome = await this.jobs.execute(JOB, () => this.runLegs(appid));
    return outcome.ran ? outcome.result : { ran: false, reason: "already running" };
  }

  private async runLegs(appid: number): Promise<SteamGameRefreshRun> {
    const startedAt = new Date();
    const beforeMinutes = await this.latestPlaytime(appid);

    // The three achievement services isolate their own upstream failures into
    // a `failed` count. Unlocks and rarity are gated on a schema with rows the
    // way their pollers gate: `refreshRarity` stamps the meta row unguarded,
    // and a schema fetch that failed may never have written one.
    const schema = await this.schemas.refreshSchemas([appid]);
    const meta = await this.prisma.steamGameAchievementMeta.findUnique({
      where: { appid },
      select: { achievementCount: true },
    });
    const hasSchema = (meta?.achievementCount ?? 0) > 0;
    const unlocks = await this.unlocks.refreshUnlocksForGame(appid);
    const rarity = hasSchema
      ? await this.rarity.refreshRarity([appid])
      : { rowsWritten: 0, failed: 0 };

    let enrichment: SteamGameRefreshRun["legs"]["enrichment"];
    try {
      enrichment = {
        written: (await this.enrichment.enrichApps([appid])) > 0,
        failed: false,
      };
    } catch (err) {
      this.logger.warn(`enrichment for appid=${appid} failed: ${err}`);
      enrichment = { written: false, failed: true };
    }

    // Steam has no per-game playtime call; this is the whole-library snapshot
    // the owned-games poller takes, run once, read back for this game.
    let playtimeFailed = false;
    try {
      await this.ownedGames.syncOwnedGames();
    } catch (err) {
      this.logger.warn(`owned-games snapshot for appid=${appid} failed: ${err}`);
      playtimeFailed = true;
    }
    const afterMinutes = playtimeFailed
      ? beforeMinutes
      : await this.latestPlaytime(appid);

    return {
      ran: true,
      appid,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      legs: {
        schema: {
          achievementCount: meta?.achievementCount ?? null,
          failed: schema.failed > 0,
        },
        unlocks: {
          newUnlocks: unlocks.newUnlocks,
          statsPrivate: unlocks.privateOnSteam > 0,
          failed: unlocks.failed > 0,
        },
        rarity: { rowsWritten: rarity.rowsWritten, failed: rarity.failed > 0 },
        enrichment,
        playtime: { beforeMinutes, afterMinutes, failed: playtimeFailed },
      },
    };
  }

  private async latestPlaytime(appid: number): Promise<number | null> {
    const row = await this.prisma.steamPlaytimeSnapshot.findFirst({
      where: { appid },
      orderBy: { snapshotDate: "desc" },
      select: { playtimeForeverMinutes: true },
    });
    return row?.playtimeForeverMinutes ?? null;
  }
}
