// One-shot manual trigger for the LoL patch-notes sync. Two modes:
//
//   node dist/src/scripts/run-patch-sync.js
//     → same code path the 6-hourly cron uses
//       (PatchService.syncIfNewPatch). Picks up the current head if it's
//       not already recorded.
//
//   node dist/src/scripts/run-patch-sync.js --last 5
//     → backfill: takes the most-recent N entries from ddragon's versions
//       list, truncates each to the wiki year-based label, skips versions
//       already in the DB, and force-syncs the rest with a 1s throttle to
//       stay polite to the wiki API.
//
// Lives under src/ so SWC emits decorator metadata for Nest DI (mirrors the
// pattern in refresh-steam-achievement-schemas.ts). Build first (nest
// build) before running.

import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { PatchService, truncateVersion } from "../lol/patch.service";
import { PrismaService } from "../prisma/prisma.service";

const WIKI_THROTTLE_MS = 1000;

async function main() {
  const logger = new Logger("RunPatchSync");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const patch = app.get(PatchService);
    const prisma = app.get(PrismaService);
    const args = process.argv.slice(2);
    const lastCount = parseLastFlag(args);
    const force = args.includes("--force");

    if (lastCount !== null) {
      await runBackfill(logger, patch, prisma, lastCount, force);
    } else {
      await runHeadSync(logger, patch, prisma);
    }
  } finally {
    await app.close();
  }
}

function parseLastFlag(args: string[]): number | null {
  const idx = args.indexOf("--last");
  if (idx === -1) return null;
  const raw = args[idx + 1];
  const n = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--last expects a positive integer, got "${raw}"`);
  }
  return n;
}

async function runHeadSync(
  logger: Logger,
  patch: PatchService,
  prisma: PrismaService
): Promise<void> {
  const synced = await patch.syncIfNewPatch();
  if (synced) {
    await logSyncedVersion(logger, prisma, synced);
  } else {
    await logRecentVersions(logger, prisma);
  }
}

async function runBackfill(
  logger: Logger,
  patch: PatchService,
  prisma: PrismaService,
  count: number,
  force: boolean
): Promise<void> {
  const ddragon = await patch.fetchVersionList();
  const candidates = Array.from(new Set(ddragon.slice(0, count).map(truncateVersion)));
  let missing: string[];
  if (force) {
    missing = candidates;
    logger.log(
      `Backfill scope — top ${count} ddragon entries → ${candidates.length} unique versions (--force: skipping existence check, re-syncing all).`
    );
  } else {
    const existing = await prisma.patchVersion.findMany({
      where: { version: { in: candidates } },
      select: { version: true },
    });
    const already = new Set(existing.map((r) => r.version));
    missing = candidates.filter((v) => !already.has(v));
    logger.log(
      `Backfill scope — top ${count} ddragon entries → ${candidates.length} unique versions ` +
        `(${already.size} already synced, ${missing.length} to fetch).`
    );
  }

  if (missing.length === 0) return;

  for (const [i, version] of missing.entries()) {
    if (i > 0) await sleep(WIKI_THROTTLE_MS);
    try {
      await patch.syncVersion(version);
      await logSyncedVersion(logger, prisma, version);
    } catch (err) {
      logger.error(
        `Failed to sync ${version}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

async function logSyncedVersion(
  logger: Logger,
  prisma: PrismaService,
  version: string
): Promise<void> {
  const counts = await prisma.patchChange.groupBy({
    by: ["section"],
    where: { patchVersion: version },
    _count: { _all: true },
  });
  const total = counts.reduce((sum, c) => sum + c._count._all, 0);
  const bySection = new Map(counts.map((c) => [c.section, c._count._all]));
  logger.log(
    `Synced patch ${version} — ${total} change rows ` +
      `(c:${bySection.get("champion") ?? 0} ` +
      `i:${bySection.get("item") ?? 0} ` +
      `r:${bySection.get("rune") ?? 0}).`
  );
}

async function logRecentVersions(logger: Logger, prisma: PrismaService): Promise<void> {
  const versions = await prisma.patchVersion.findMany({
    orderBy: { version: "desc" },
    take: 5,
  });
  logger.log("No new patch — current head already recorded. Recent versions:");
  for (const v of versions) {
    const counts = await prisma.patchChange.groupBy({
      by: ["section"],
      where: { patchVersion: v.version },
      _count: { _all: true },
    });
    const total = counts.reduce((sum, c) => sum + c._count._all, 0);
    const bySection = new Map(counts.map((c) => [c.section, c._count._all]));
    logger.log(
      `  ${v.version} — ${total} rows ` +
        `(c:${bySection.get("champion") ?? 0} ` +
        `i:${bySection.get("item") ?? 0} ` +
        `r:${bySection.get("rune") ?? 0})`
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
