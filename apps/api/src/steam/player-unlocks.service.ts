import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SteamClientService } from "./steam-client.service";
import { STEAM_OWNER_ID } from "./steam.config";

export interface UnlocksSyncResult {
  checked: number;
  newUnlocks: number;
  failed: number;
}

@Injectable()
export class SteamPlayerUnlocksService {
  private readonly logger = new Logger(SteamPlayerUnlocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService
  ) {}

  // Fetches GetPlayerAchievements for each appid (one Steam call per game —
  // not batched) and inserts new unlock rows. `skipDuplicates: true` on the
  // composite PK `(appid, apiName)` makes the operation idempotent: once an
  // unlock is recorded, future polls leave it untouched (preserves the
  // historical `unlockedAt` from Steam's `unlocktime`).
  //
  // Caller filters appids upstream — this service trusts the input and does
  // not re-check `achievementCount > 0`. The `SteamPlayerUnlock` FK
  // references `SteamGameAchievement(appid, apiName)`, so passing a
  // schema-less appid would fail on insert; the poller's where-clause + the
  // owned-games-service on-add filter both gate by `achievementCount > 0`.
  //
  // Steam's `success: false` (owner has no playerstats — privacy, never
  // launched stats, etc.) returns `null` from the client method. We still
  // stamp `lastUnlocksCheckedAt` so the meta row reflects the most recent
  // attempt; we don't permanently skip these games because playerstats
  // visibility can flip back on at any time.
  async syncUnlocks(appids: number[]): Promise<UnlocksSyncResult> {
    if (appids.length === 0) return { checked: 0, newUnlocks: 0, failed: 0 };
    const start = Date.now();
    let checked = 0;
    let newUnlocks = 0;
    let failed = 0;

    for (const appid of appids) {
      let achievements: Awaited<ReturnType<SteamClientService["getPlayerAchievements"]>>;
      try {
        achievements = await this.client.getPlayerAchievements(STEAM_OWNER_ID, appid);
      } catch (err) {
        failed += 1;
        this.logger.warn(`unlock fetch for appid=${appid} failed: ${err}`);
        continue;
      }

      const now = new Date();

      if (achievements !== null && achievements.length > 0) {
        const unlocked = achievements
          .filter((a) => a.achieved === 1 && a.unlocktime > 0)
          .map((a) => ({
            appid,
            apiName: a.apiname,
            unlockedAt: new Date(a.unlocktime * 1000),
          }));
        if (unlocked.length > 0) {
          const result = await this.prisma.steamPlayerUnlock.createMany({
            data: unlocked,
            skipDuplicates: true,
          });
          newUnlocks += result.count;
        }
      }

      await this.prisma.steamGameAchievementMeta.update({
        where: { appid },
        data: { lastUnlocksCheckedAt: now },
      });
      checked += 1;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `checked unlocks for ${checked}/${appids.length} apps (new=${newUnlocks}, failed=${failed}) in ${duration}ms`
    );
    return { checked, newUnlocks, failed };
  }
}
