import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SteamClientService } from "./steam-client.service";

export interface RaritySyncResult {
  checked: number;
  rowsWritten: number;
  historyRowsAppended: number;
  failed: number;
}

// Steam publishes one decimal — a probe over 857 achievements found all 91
// moves to be exactly ±0.1pp and none smaller — but serialises it through a
// float32, so values arrive as 47.900001525878906. Comparing the raw doubles
// would append representation noise as if it were drift, so the "did it move"
// test runs on the rounded value while the row stores exactly what Steam sent.
function movedAtSteamPrecision(previous: number | undefined, next: number): boolean {
  if (previous === undefined) return true;
  return Math.round(previous * 10) !== Math.round(next * 10);
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
  // achievement exists). The same reasoning covers history rows for a game
  // the owner has since removed — the poller stops feeding them, and what
  // already accrued is worth more kept than reclaimed.
  async refreshRarity(appids: number[]): Promise<RaritySyncResult> {
    if (appids.length === 0)
      return { checked: 0, rowsWritten: 0, historyRowsAppended: 0, failed: 0 };
    const start = Date.now();
    let checked = 0;
    let rowsWritten = 0;
    let historyRowsAppended = 0;
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
        const appended = await this.prisma.$transaction(async (tx) => {
          // Read the outgoing values inside the transaction, before the upsert
          // overwrites them — this is the only moment the previous reading
          // still exists anywhere.
          const previous = new Map(
            (
              await tx.steamAchievementGlobalRarity.findMany({
                where: { appid },
                select: { apiName: true, percent: true },
              })
            ).map((r) => [r.apiName, r.percent])
          );

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

          // Append-only, and only for what moved. Appending every reading
          // would cost an order of magnitude more rows to say the same thing:
          // roughly a tenth of the tracked achievements move in a given week.
          // An achievement with no previous row counts as moved so its series
          // gets an origin rather than starting at its first change.
          const moved = percentages.filter((p) =>
            movedAtSteamPrecision(previous.get(p.name), p.percent)
          );
          if (moved.length > 0) {
            await tx.steamAchievementRarityHistory.createMany({
              data: moved.map((p) => ({
                appid,
                apiName: p.name,
                percent: p.percent,
                observedAt: now,
              })),
            });
          }
          return moved.length;
        });
        rowsWritten += percentages.length;
        historyRowsAppended += appended;
      }

      await this.prisma.steamGameAchievementMeta.update({
        where: { appid },
        data: { lastRarityCheckedAt: now },
      });
      checked += 1;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `refreshed rarity for ${checked}/${appids.length} apps (rows=${rowsWritten}, history=${historyRowsAppended}, failed=${failed}) in ${duration}ms`
    );
    return { checked, rowsWritten, historyRowsAppended, failed };
  }
}
