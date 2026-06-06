import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const SGDB_BASE = "https://www.steamgriddb.com/api/v2";
const FETCH_TIMEOUT_MS = 5_000;

// Minimum width we'll accept from SGDB. Steam's own 1x hero is 1920×620, so
// anything narrower than that is no improvement over the fallback we already
// have. Most SGDB heroes are 1920×620 or 3840×1240 — the bimodal native sizes
// match Steam's library asset spec.
const MIN_HERO_WIDTH = 1920;

// Cool-down window before we re-query SGDB for an appid we already checked.
// Aligned with the monthly enrichment cron (`30 4 1 * *`): a manual mid-cycle
// re-run of enrichment shouldn't re-spam SGDB for the same null-hero set, but
// the next monthly tick should still pick up publishers who uploaded art.
const SGDB_RECHECK_DAYS = 25;

// Concurrent SGDB requests during a backfill pass. SGDB is a small community
// service; keep this conservative even though the per-call rate limits are
// generous on a Bearer-authed key.
const SGDB_CONCURRENCY = 4;

export interface SgdbHero {
  url: string;
  width: number;
  height: number;
}

interface SgdbHeroRow {
  id: number;
  score: number;
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  epilepsy: boolean;
  url: string;
  mime?: string;
}

interface SgdbHeroResponse {
  success: boolean;
  data?: SgdbHeroRow[];
  // SGDB returns `errors: string[]` on failures.
  errors?: string[];
}

/**
 * Client for SteamGridDB's community-uploaded hero assets, used as a fallback
 * when a Steam publisher hasn't shipped `library_hero_2x.jpg` themselves (e.g.
 * RE3). Single method — given a Steam appid, returns the highest-scored hero
 * the community has uploaded at ≥1920w, or null when nothing usable exists.
 *
 * Optional integration: API key is read at construction; if missing the
 * service stays operational but every call short-circuits to null + a single
 * boot warning. This keeps enrichment runs working on hosts/CI without the
 * key configured.
 */
@Injectable()
export class SteamGridDbService {
  private readonly logger = new Logger(SteamGridDbService.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly prisma: PrismaService) {
    this.apiKey = process.env.STEAM_GRIDDB_API_KEY;
    if (!this.apiKey) {
      this.logger.warn(
        "STEAM_GRIDDB_API_KEY missing — SteamGridDb fallback disabled, heroes for publishers without library_hero_2x.jpg will use 1x"
      );
    }
  }

  /**
   * Backfill SGDB heroes for the supplied appids whose publisher hero is
   * missing and which haven't been SGDB-checked within `SGDB_RECHECK_DAYS`.
   * Mirrors the shape of `SteamSubjectAnchorService.computeMissingAnchors` —
   * called as a post-pass from the enrichment service after the main upserts
   * land. Failure is non-fatal; the watermark is set even on null results so
   * we don't re-query SGDB for the same null-hero set on a manual mid-cycle
   * re-run of enrichment.
   *
   * `target` switches the source table:
   *   - "owned"    → `SteamGameEnrichment`, filters `libraryHero2xPath IS NULL`
   *                  (only the 2x asset matters for the full-bleed surface).
   *   - "wishlist" → `SteamWishlistAsset`, filters `libraryHeroPath IS NULL`
   *                  (broader signal: wishlist publishers who skipped the
   *                  entire modern library spec, e.g. Townfall — appid
   *                  1636440 — fall here and SGDB is the only quality source).
   */
  async backfillMissingHeroes(
    appids: number[],
    target: "owned" | "wishlist" = "owned"
  ): Promise<number> {
    if (appids.length === 0) return 0;
    if (!this.apiKey) return 0;

    const cutoff = new Date(Date.now() - SGDB_RECHECK_DAYS * 24 * 60 * 60 * 1000);
    const rows =
      target === "owned"
        ? await this.prisma.steamGameEnrichment.findMany({
            where: {
              appid: { in: appids },
              libraryHero2xPath: null,
              OR: [{ sgdbEnrichedAt: null }, { sgdbEnrichedAt: { lt: cutoff } }],
            },
            select: { appid: true },
          })
        : await this.prisma.steamWishlistAsset.findMany({
            where: {
              appid: { in: appids },
              libraryHeroPath: null,
              OR: [{ sgdbEnrichedAt: null }, { sgdbEnrichedAt: { lt: cutoff } }],
            },
            select: { appid: true },
          });
    if (rows.length === 0) return 0;

    const start = Date.now();
    let updated = 0;
    for (let i = 0; i < rows.length; i += SGDB_CONCURRENCY) {
      const batch = rows.slice(i, i + SGDB_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (row) => ({
          appid: row.appid,
          hero: await this.findHero(row.appid),
        }))
      );
      for (const { appid, hero } of results) {
        // The watermark advances regardless of result — a null is a signal
        // that we already checked, not "we haven't checked yet". Without
        // this, every retry would re-query SGDB for the same null set.
        const data = {
          sgdbHeroUrl: hero?.url ?? null,
          sgdbHeroWidth: hero?.width ?? null,
          sgdbHeroHeight: hero?.height ?? null,
          sgdbEnrichedAt: new Date(),
        };
        if (target === "owned") {
          await this.prisma.steamGameEnrichment.update({ where: { appid }, data });
        } else {
          await this.prisma.steamWishlistAsset.update({ where: { appid }, data });
        }
        if (hero) updated += 1;
      }
    }

    const duration = Date.now() - start;
    this.logger.log(
      `SteamGridDb backfill (${target}): ${updated}/${rows.length} apps got a hero in ${duration}ms`
    );
    return updated;
  }

  async findHero(appid: number): Promise<SgdbHero | null> {
    if (!this.apiKey) return null;

    // Hero rows can be tagged with `style=alternate|blurred|material|no_logo|
    // white_logo`; we don't constrain because the highest-scored row is
    // typically the canonical art regardless of style label. `types=static`
    // excludes animated heroes (we want a still backdrop). NSFW/humor/
    // epilepsy filters belt-and-suspender — also re-filtered client-side
    // since the API filter is documented as "all|true|false" and some
    // mirror nodes ignore it.
    const params = new URLSearchParams({
      types: "static",
      nsfw: "false",
      humor: "false",
      epilepsy: "false",
    });
    const url = `${SGDB_BASE}/heroes/steam/${appid}?${params.toString()}`;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: ac.signal,
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
    } catch (err) {
      this.logger.warn(`SteamGridDb fetch failed for appid=${appid}: ${String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }

    // 404 — SGDB doesn't know the appid (rare but possible for delisted /
    // very-new titles). Treat as "no hero", not an error.
    if (res.status === 404) return null;
    if (!res.ok) {
      this.logger.warn(`SteamGridDb HTTP ${res.status} for appid=${appid}`);
      return null;
    }

    let body: SgdbHeroResponse;
    try {
      body = (await res.json()) as SgdbHeroResponse;
    } catch (err) {
      this.logger.warn(
        `SteamGridDb JSON parse failed for appid=${appid}: ${String(err)}`
      );
      return null;
    }

    if (!body.success || !body.data || body.data.length === 0) return null;

    // Defensive client-side filter — see comment above on the URL params.
    const usable = body.data.filter(
      (row) =>
        !row.nsfw &&
        !row.humor &&
        !row.epilepsy &&
        row.width >= MIN_HERO_WIDTH &&
        !!row.url
    );
    if (usable.length === 0) return null;

    // Highest score wins; tiebreak by width desc so a 3840×1240 beats a
    // 1920×620 at the same score (the larger source survives downscale
    // sampling better at 2560w consumer width).
    usable.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.width - a.width;
    });

    const top = usable[0];
    if (!top) return null;
    return { url: top.url, width: top.width, height: top.height };
  }
}
