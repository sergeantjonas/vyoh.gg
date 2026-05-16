import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SteamPicsService } from "./pics.service";
import { SteamClientService } from "./steam-client.service";
import type { SteamStoreItemFullRaw } from "./types";

// Steam's IStoreBrowseService accepts many ids per call. Empirical batch size
// of 50 keeps the input_json payload well under any documented URL ceiling
// while still cutting per-app overhead for a ~200-game library down to a
// handful of calls.
const ENRICHMENT_BATCH_SIZE = 50;

// Cap on community tag ids stored per app. Steam exposes 20+; the top weights
// carry the genre-equivalent signal and keep the Int[] column queryable.
const MAX_TAG_IDS = 20;

export interface EnrichmentUpsert {
  appid: number;
  assetUrlFormat: string | null;
  assetTimestamp: bigint | null;
  libraryCapsulePath: string | null;
  libraryCapsule2xPath: string | null;
  libraryHeroPath: string | null;
  libraryHero2xPath: string | null;
  headerPath: string | null;
  heroCapsulePath: string | null;
  // PICS-sourced wordmark hash; IStoreBrowseService doesn't expose this.
  // Merged in by the enricher via SteamPicsService. Null when PICS returns no
  // logo entry for the app (older titles where unhashed legacy is the only
  // path); frontend falls back to that.
  logoPath: string | null;
  appType: number | null;
  releaseDate: Date | null;
  isFree: boolean | null;
  tagIds: number[];
  featureCategoryIds: number[];
}

// Pure-function projection of the raw Steam shape into a row-shaped upsert.
// Split out for testability and to keep the I/O wrapper a thin shell over
// fetch + upsert. Returns null when the upstream item didn't resolve
// (`success !== 1`) — caller should skip rather than persist garbage.
// `logoPath` is merged in separately (PICS), not derived from `raw`.
export function projectEnrichment(
  raw: SteamStoreItemFullRaw,
  logoPath: string | null = null
): EnrichmentUpsert | null {
  if (raw.success !== 1) return null;

  const assets = raw.assets;
  const release = raw.release;
  const categories = raw.categories;

  // `asset_url_format` is shaped like `"steam/apps/{appid}/${FILENAME}?t=1776125684"`.
  // The `?t=` epoch is Steam's cache-buster — when publishers refresh art,
  // this moves and per-asset path hashes change in lockstep. Storing it
  // lets the refresh poller pick "art updated" vs "metadata unchanged"
  // without diffing every per-asset field.
  let assetTimestamp: bigint | null = null;
  if (assets?.asset_url_format) {
    const match = assets.asset_url_format.match(/\?t=(\d+)/);
    if (match?.[1]) {
      const parsed = BigInt(match[1]);
      assetTimestamp = parsed;
    }
  }

  const releaseDate =
    release?.steam_release_date && release.steam_release_date > 0
      ? new Date(release.steam_release_date * 1000)
      : null;

  return {
    appid: raw.appid,
    assetUrlFormat: assets?.asset_url_format ?? null,
    assetTimestamp,
    libraryCapsulePath: assets?.library_capsule ?? null,
    libraryCapsule2xPath: assets?.library_capsule_2x ?? null,
    libraryHeroPath: assets?.library_hero ?? null,
    libraryHero2xPath: assets?.library_hero_2x ?? null,
    headerPath: assets?.header ?? null,
    heroCapsulePath: assets?.hero_capsule ?? null,
    logoPath,
    appType: raw.type ?? null,
    releaseDate,
    isFree: raw.is_free ?? null,
    tagIds: (raw.tagids ?? []).slice(0, MAX_TAG_IDS),
    featureCategoryIds: categories?.feature_categoryids ?? [],
  };
}

@Injectable()
export class SteamEnrichmentService {
  private readonly logger = new Logger(SteamEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SteamClientService,
    private readonly pics: SteamPicsService
  ) {}

  // Fetches IStoreBrowseService/GetItems for the supplied appids in batches
  // and upserts each into SteamGameEnrichment. Silently skips ids that the
  // upstream doesn't resolve (delisted / region-blocked / hidden) so a single
  // bad id doesn't abort the rest of the batch. Returns the count of rows
  // actually persisted, for the caller's log line.
  //
  // PICS is queried once per call (single anonymous logon, all appids in one
  // getProductInfo) and merged in by appid. A PICS failure is non-fatal:
  // logged and the GetItems-derived enrichment still lands with logoPath null.
  async enrichApps(appids: number[]): Promise<number> {
    if (appids.length === 0) return 0;
    const start = Date.now();
    let written = 0;
    let skipped = 0;

    const logoByAppid = await this.fetchLogoMap(appids);

    for (let i = 0; i < appids.length; i += ENRICHMENT_BATCH_SIZE) {
      const batch = appids.slice(i, i + ENRICHMENT_BATCH_SIZE);
      const items = await this.client.getStoreItemsFull(batch);

      for (const raw of items) {
        const row = projectEnrichment(raw, logoByAppid.get(raw.appid) ?? null);
        if (row === null) {
          skipped += 1;
          continue;
        }
        await this.prisma.steamGameEnrichment.upsert({
          where: { appid: row.appid },
          create: { ...row, enrichedAt: new Date() },
          update: { ...row, enrichedAt: new Date() },
        });
        written += 1;
      }
    }

    const duration = Date.now() - start;
    this.logger.log(
      `enriched ${written}/${appids.length} apps (skipped=${skipped}) in ${duration}ms`
    );
    return written;
  }

  private async fetchLogoMap(appids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    try {
      const assets = await this.pics.getLogoAssets(appids);
      for (const asset of assets) {
        if (asset.logoPath) map.set(asset.appid, asset.logoPath);
      }
      this.logger.log(`PICS resolved ${map.size}/${appids.length} logo hashes`);
    } catch (err) {
      this.logger.warn(
        `PICS logo fetch failed, continuing with logoPath=null: ${describeError(err)}`
      );
    }
    return map;
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
