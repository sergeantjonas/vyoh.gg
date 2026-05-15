import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SteamClientService } from "./steam-client.service";

export interface RaritySyncResult {
  checked: number;
  rowsWritten: number;
  failed: number;
}

@Injectable()
export class SteamGlobalRarityService {
  private readonly logger = new Logger(SteamGlobalRarityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService
  ) {}

  // Fetches GetGlobalAchievementPercentagesForApp for each appid (one Steam
  // call per game) and upserts each achievement's global unlock percentage.
  // The endpoint is unauthenticated but still routed through the limiter for
  // budget bookkeeping. Single-appid failures are logged and skipped.
  //
  // Like the unlocks poller, the FK on `SteamAchievementGlobalRarity` →
  // `SteamGameAchievement(appid, apiName)` requires the schema to exist
  // first. Caller filters by `achievementCount > 0` upstream.
  //
  // Stale-row cleanup is intentionally absent: Steam essentially never
  // removes a published achievement, and even after a hypothetical removal
  // a stale rarity row is cheap to ignore (the join goes through
  // SteamGameAchievement, which is the source of truth for whether an
  // achievement exists).
  async refreshRarity(appids: number[]): Promise<RaritySyncResult> {
    if (appids.length === 0) return { checked: 0, rowsWritten: 0, failed: 0 };
    const start = Date.now();
    let checked = 0;
    let rowsWritten = 0;
    let failed = 0;

    for (const appid of appids) {
      let percentages: Awaited<
        ReturnType<SteamClientService["getGlobalAchievementPercentages"]>
      >;
      try {
        percentages = await this.client.getGlobalAchievementPercentages(appid);
      } catch (err) {
        failed += 1;
        this.logger.warn(`global-rarity fetch for appid=${appid} failed: ${err}`);
        continue;
      }

      const now = new Date();
      if (percentages.length > 0) {
        // Upsert each — `createMany` with `skipDuplicates: true` would
        // ignore stale rows (we want them updated). A small per-game N
        // (typically 30–200 achievements) makes the per-row upsert
        // tolerable; the alternative (delete-then-createMany) would race
        // against the read side.
        await this.prisma.$transaction(async (tx) => {
          for (const p of percentages) {
            await tx.steamAchievementGlobalRarity.upsert({
              where: { appid_apiName: { appid, apiName: p.name } },
              create: {
                appid,
                apiName: p.name,
                percent: p.percent,
                polledAt: now,
              },
              update: { percent: p.percent, polledAt: now },
            });
          }
        });
        rowsWritten += percentages.length;
      }

      await this.prisma.steamGameAchievementMeta.update({
        where: { appid },
        data: { lastRarityCheckedAt: now },
      });
      checked += 1;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `refreshed rarity for ${checked}/${appids.length} apps (rows=${rowsWritten}, failed=${failed}) in ${duration}ms`
    );
    return { checked, rowsWritten, failed };
  }
}
