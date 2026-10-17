import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SteamClientService } from "../client/steam-client.service";
import type { SteamGameAchievementSchema } from "../client/types";

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
      // Guarded per-appid for the same reason the fetch above is: one bad id
      // must never abort the rest of the batch. A write failure here used to
      // throw out of `refreshSchemas` entirely, so every appid after it in
      // the list silently kept whatever count it already had — including a
      // stale zero, which gates all unlock ingestion for that game.
      try {
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
      } catch (err) {
        failed += 1;
        this.logger.warn(`schema write for appid=${appid} failed: ${err}`);
        continue;
      }

      fetched += 1;
      if (achievements.length > 0) withAchievements += 1;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `fetched schemas for ${fetched}/${appids.length} apps (with-achievements=${withAchievements}, failed=${failed}) in ${duration}ms`
    );
    return { fetched, withAchievements, failed };
  }

  // The stored schema trails Steam between weekly refreshes: a live game
  // ships achievements, and the unlock and rarity endpoints name them before
  // this table does. Writing one of those names breaks the FK to
  // `SteamGameAchievement` and aborts the caller's whole pass, so callers hand
  // over the names Steam just returned and write only what comes back. Drift
  // refetches this one game's schema on the spot rather than waiting out the
  // week; a name still missing afterwards (the schema endpoint lagging its
  // siblings, or the refetch failing) is the caller's to skip. A name that
  // never reaches the schema costs one schema call per pass, so a warning
  // that recurs for the same game is the cue to look.
  async knownApiNames(appid: number, names: readonly string[]): Promise<Set<string>> {
    if (names.length === 0) return new Set();
    const known = await this.storedApiNames(appid);
    if (names.every((n) => known.has(n))) return known;
    await this.refreshSchemas([appid]);
    return this.storedApiNames(appid);
  }

  private async storedApiNames(appid: number): Promise<Set<string>> {
    const rows = await this.prisma.steamGameAchievement.findMany({
      where: { appid },
      select: { apiName: true },
    });
    return new Set(rows.map((r) => r.apiName));
  }
}
