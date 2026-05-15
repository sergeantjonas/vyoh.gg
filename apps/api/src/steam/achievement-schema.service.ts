import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SteamClientService } from "./steam-client.service";
import type { SteamGameAchievementSchema } from "./types";

export interface SchemaRefreshResult {
  fetched: number;
  withAchievements: number;
  failed: number;
}

@Injectable()
export class SteamAchievementSchemaService {
  private readonly logger = new Logger(SteamAchievementSchemaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService
  ) {}

  // Fetches GetSchemaForGame for each appid (one Steam call per game — the
  // endpoint isn't batched), upserts achievement rows, and stamps the meta
  // sidecar with `achievementCount` + `lastSchemaCheckedAt`. Games returning
  // an empty achievement list still get a meta row (count=0) so later passes
  // can distinguish "checked, none" from "never checked". A single appid's
  // failure (delisted, timeout, schema-less stats game) is logged and
  // skipped — one bad id never aborts the rest.
  //
  // Achievement removals aren't reconciled: Steam essentially never removes
  // shipped achievements, and a rare stale row is preferable to a
  // delete-then-restore race during a partial fetch. Add reconciliation if
  // a removal actually shows up.
  async refreshSchemas(appids: number[]): Promise<SchemaRefreshResult> {
    if (appids.length === 0) return { fetched: 0, withAchievements: 0, failed: 0 };
    const start = Date.now();
    let fetched = 0;
    let withAchievements = 0;
    let failed = 0;

    for (const appid of appids) {
      let achievements: SteamGameAchievementSchema[];
      try {
        achievements = await this.client.getGameAchievementSchema(appid);
      } catch (err) {
        failed += 1;
        this.logger.warn(`schema fetch for appid=${appid} failed: ${err}`);
        continue;
      }

      const now = new Date();
      await this.prisma.$transaction(async (tx) => {
        for (const a of achievements) {
          await tx.steamGameAchievement.upsert({
            where: { appid_apiName: { appid, apiName: a.apiName } },
            create: {
              appid,
              apiName: a.apiName,
              displayName: a.displayName,
              description: a.description,
              iconUrl: a.iconUrl,
              iconGrayUrl: a.iconGrayUrl,
              hidden: a.hidden,
              schemaFetchedAt: now,
            },
            update: {
              displayName: a.displayName,
              description: a.description,
              iconUrl: a.iconUrl,
              iconGrayUrl: a.iconGrayUrl,
              hidden: a.hidden,
              schemaFetchedAt: now,
            },
          });
        }

        await tx.steamGameAchievementMeta.upsert({
          where: { appid },
          create: {
            appid,
            achievementCount: achievements.length,
            lastSchemaCheckedAt: now,
          },
          update: {
            achievementCount: achievements.length,
            lastSchemaCheckedAt: now,
          },
        });
      });

      fetched += 1;
      if (achievements.length > 0) withAchievements += 1;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `fetched schemas for ${fetched}/${appids.length} apps (with-achievements=${withAchievements}, failed=${failed}) in ${duration}ms`
    );
    return { fetched, withAchievements, failed };
  }
}
