import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { NO_CURATION, OWNER_TIME_ZONE } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SyncJobRegistry } from "../sync-jobs/sync-job-registry.service";
import { SYNC_JOBS } from "../sync-jobs/sync-jobs.catalog";
import { SteamEnrichmentService } from "./enrichment.service";
import { SteamService } from "./steam.service";
import { SteamSubjectAnchorService } from "./subject-anchor.service";

const JOB = "steam-enrichment";

// Enrichment data (asset hashes, type, release date, tags) shifts only when a
// publisher updates store art or metadata, so each row wants revisiting about
// monthly. That month is an age rather than a fire on the 1st, for the reason
// in achievement-schema.poller.ts: `@nestjs/schedule` does not replay a fire
// the process was down for, and a monthly cron is the one where a single miss
// costs the most.
//
// Coverage spans both owned games and the wishlist, so the image proxy can
// resolve hashed asset paths for not-yet-owned titles. On-add coverage comes
// from the syncOwnedGames diff hook (see owned-games.service.ts); on-boot
// coverage comes from OnModuleInit, which now runs the same selection as the
// tick rather than only picking up incomplete rows.
const ENRICHMENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Unreleased titles are the exception to the monthly rhythm: an announced date
// slips or firms up repeatedly before launch, and `comingSoon` only drops on
// Steam's launch sweep. Both feed the upcoming surface directly, so a row still
// flagged coming-soon is re-pulled daily. The set is a handful of rows against
// the batch cap below.
const COMING_SOON_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Bounds one pass. Steady state is ~227 candidates / 30 ≈ 8 a day, so the cap
// only engages after downtime, and stays well above that arrival rate so the
// oldest rows still drain.
const ENRICHMENT_BATCH_CAP = 25;
@Injectable()
export class SteamEnrichmentPoller implements OnModuleInit {
  private readonly logger = new Logger(SteamEnrichmentPoller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly service: SteamEnrichmentService,
    private readonly steam: SteamService,
    private readonly anchors: SteamSubjectAnchorService,
    private readonly jobs: SyncJobRegistry
  ) {}

  async onModuleInit(): Promise<void> {
    const candidates = await this.candidateAppids();
    if (candidates.length === 0) return;

    // Routed through the registry like the tick: the boot pass does the same
    // reconciliation, and it is the pass that actually runs on a machine that
    // is not alive at the cron's wall-clock hour.
    await this.jobs.run(JOB, () => this.refreshDue(candidates, "boot"));

    // Saliency anchors are a newer column than enrichment itself, so
    // already-enriched rows can still have null `subjectXPercent`. Run the
    // anchor pass against the full candidate list — the IS NULL filter
    // makes this a no-op once every row is anchored. Deliberately not
    // bounded by the batch cap above: this is local work, not Steam calls.
    try {
      await this.anchors.computeMissingAnchors(candidates);
    } catch (err) {
      this.logger.warn(`boot anchor backfill failed: ${err}`);
    }
  }

  @Cron(SYNC_JOBS[JOB].cron, { name: JOB, timeZone: OWNER_TIME_ZONE })
  async tick(): Promise<void> {
    await this.jobs.run(JOB, async () => {
      // Full refresh — re-pulls every owned + wishlisted appid. Lets us detect
      // publisher art swaps via assetTimestamp without per-row diff logic.
      const candidates = await this.candidateAppids();
      await this.refreshDue(candidates, "tick");
    });
  }

  private async refreshDue(candidates: number[], source: string): Promise<void> {
    const due = await this.dueAppids(candidates);
    if (due.length === 0) return;
    this.logger.log(`enriching ${due.length} due apps (${source})`);
    await this.service.enrichApps(due);
  }

  // Due means one of: no enrichment row at all, an incomplete row, or a row
  // past the max age. "Incomplete" is logoPath IS NULL, the only field sourced
  // from a separate channel (PICS) since S5.5.B — titles PICS can't resolve
  // (older / unpublished / hidden) stay null forever and so read as due on
  // every pass. That doesn't starve the stale rows behind them, because
  // enrichApps restamps `enrichedAt` whether or not logoPath resolved, which
  // sorts them to the back of the queue until everything else has had a turn.
  private async dueAppids(candidates: number[]): Promise<number[]> {
    const rows = await this.prisma.steamGameEnrichment.findMany({
      where: { appid: { in: candidates } },
      select: { appid: true, logoPath: true, enrichedAt: true, comingSoon: true },
    });
    const byAppid = new Map(rows.map((r) => [r.appid, r]));
    const now = Date.now();
    const cutoff = now - ENRICHMENT_MAX_AGE_MS;
    const comingSoonCutoff = now - COMING_SOON_MAX_AGE_MS;
    const stamp = (appid: number): number =>
      byAppid.get(appid)?.enrichedAt.getTime() ?? 0;

    return candidates
      .filter((appid) => {
        const row = byAppid.get(appid);
        if (!row) return true;
        if (row.logoPath === null) return true;
        if (row.comingSoon) return row.enrichedAt.getTime() < comingSoonCutoff;
        return row.enrichedAt.getTime() < cutoff;
      })
      .sort((a, b) => stamp(a) - stamp(b))
      .slice(0, ENRICHMENT_BATCH_CAP);
  }

  // Owned + wishlist appids, deduped. Wishlist failures are non-fatal so a
  // transient Steam outage doesn't stall the owned-side enrichment loop.
  private async candidateAppids(): Promise<number[]> {
    const owned = await this.prisma.steamOwnedGame.findMany({
      where: { removedAt: null },
      select: { appid: true },
    });
    let wishlist: number[] = [];
    try {
      // `NO_CURATION`: enrichment is data maintenance, and a hidden game still
      // needs its row refreshed — hiding it from visitors is a display decision,
      // not a decision to stop tracking it.
      const w = await this.steam.getOwnerWishlist(NO_CURATION);
      wishlist = w.items.map((i) => i.appid);
    } catch (err) {
      this.logger.warn(
        `wishlist fetch failed (${String(err)}); proceeding with owned only`
      );
    }
    return Array.from(new Set([...owned.map((g) => g.appid), ...wishlist]));
  }
}
