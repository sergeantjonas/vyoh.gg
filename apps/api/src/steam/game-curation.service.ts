import { Injectable } from "@nestjs/common";
import { type SteamCurationSets, curationForOwner } from "@vyoh/shared";
import { PrismaService } from "../prisma/prisma.service";

// Nearly every Steam read path consults the overlay, so it is cached in-process
// rather than re-queried per request. Both writers — the admin controller and
// the owned-games poller — call `invalidate()`, so the TTL is not what keeps the
// cache fresh in normal operation; it is there so a row edited straight in psql
// takes effect on its own rather than waiting for a restart. Kept short because
// the failure mode it bounds is a hidden game staying visible.
const CACHE_TTL_MS = 60_000;

type Cached = {
  sets: SteamCurationSets;
  pendingReview: number;
  expiresAt: number;
};

@Injectable()
export class SteamGameCurationService {
  private cache: Cached | null = null;
  // Concurrent first reads (the four Steam route loaders fire together on a
  // cold render) would otherwise each issue the same query before any of them
  // populated the cache.
  private inFlight: Promise<Cached> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** The overlay as a visitor sees it: both axes applied. */
  async getCuration(): Promise<SteamCurationSets> {
    return (await this.load()).sets;
  }

  /**
   * The overlay for a given viewer. The owner sees hidden games — that was an
   * explicit product decision, not an oversight — so only the editorial axis
   * survives for them.
   */
  async getCurationFor(isOwner: boolean): Promise<SteamCurationSets> {
    const { sets } = await this.load();
    return isOwner ? curationForOwner(sets) : sets;
  }

  /** How many newly-discovered titles are still awaiting the owner's ruling. */
  async pendingReviewCount(): Promise<number> {
    return (await this.load()).pendingReview;
  }

  /** Called by every writer the moment it commits. */
  invalidate(): void {
    this.cache = null;
    this.inFlight = null;
  }

  private async load(): Promise<Cached> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.query(now).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async query(now: number): Promise<Cached> {
    const rows = await this.prisma.steamGameCuration.findMany({
      select: { appid: true, hiddenAt: true, unfeaturedAt: true, reviewedAt: true },
    });

    const hidden = new Set<number>();
    const unfeatured = new Set<number>();
    let pendingReview = 0;
    for (const row of rows) {
      if (row.hiddenAt !== null) hidden.add(row.appid);
      if (row.unfeaturedAt !== null) unfeatured.add(row.appid);
      if (row.reviewedAt === null) pendingReview += 1;
    }

    const cached: Cached = {
      sets: { hidden, unfeatured },
      pendingReview,
      expiresAt: now + CACHE_TTL_MS,
    };
    this.cache = cached;
    return cached;
  }
}
