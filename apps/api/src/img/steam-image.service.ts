import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Resolved } from "./lol-image.service";

const STEAM_CDN_HOST = "https://shared.akamai.steamstatic.com";
const STEAM_STORE_ASSETS_PATH = "store_item_assets";
const STEAM_STORE_BG_HOST = "https://store.akamai.steamstatic.com";

// Compose the hashed → legacy fallback chain for a single Steam asset. When
// enrichment has a content-hashed path the proxy hits it first (immutable,
// CDN-cacheable). On 404 — typical for titles where the publisher hasn't
// uploaded the modern variant — the proxy retries the unhashed legacy
// filename at the same `apps/{appid}` root. Both URLs are returned together
// rather than resolved across two HTTP round-trips so the chain runs
// server-side without exposing the fallback to the client.
function composeAssetUrls(
  appid: number,
  hashedPath: string | null | undefined,
  timestamp: bigint | null | undefined,
  legacyFilename: string
): string[] {
  const legacy = `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/${legacyFilename}`;
  if (!hashedPath) return [legacy];
  const t = timestamp != null ? `?t=${timestamp.toString()}` : "";
  const hashed = `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/${hashedPath}${t}`;
  return [hashed, legacy];
}

@Injectable()
export class SteamImageService {
  constructor(private readonly prisma: PrismaService) {}

  // Union lookup over `SteamGameEnrichment` (owned games) and
  // `SteamWishlistAsset` (wishlist titles). Owned-games rows always win when
  // both exist — the enrichment pipeline carries richer metadata (logo path
  // via PICS) that wishlist sync doesn't fetch. The shape returned by both
  // is structurally compatible for the per-asset fields the image proxy
  // needs (every column on `SteamWishlistAsset` is a strict subset of
  // `SteamGameEnrichment`). Centralising the union here keeps each route a
  // one-liner and prevents per-route drift in the lookup order.
  private async resolveAssetRow(appid: number): Promise<{
    libraryCapsulePath: string | null;
    libraryHeroPath: string | null;
    libraryHero2xPath: string | null;
    headerPath: string | null;
    assetTimestamp: bigint | null;
    sgdbHeroUrl: string | null;
  } | null> {
    const enrichment = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: {
        libraryCapsulePath: true,
        libraryHeroPath: true,
        libraryHero2xPath: true,
        headerPath: true,
        assetTimestamp: true,
        sgdbHeroUrl: true,
      },
    });
    if (enrichment) return enrichment;
    return this.prisma.steamWishlistAsset.findUnique({
      where: { appid },
      select: {
        libraryCapsulePath: true,
        libraryHeroPath: true,
        libraryHero2xPath: true,
        headerPath: true,
        assetTimestamp: true,
        sgdbHeroUrl: true,
      },
    });
  }

  // 231×87 cover capsule. Sourced from `header.jpg` (460×215) and Sharp-
  // cropped to the canonical cover ratio. `libraryCapsule` is the separate
  // 600×900 portrait — different asset, different route.
  async capsule(appid: number): Promise<Resolved> {
    const row = await this.resolveAssetRow(appid);
    return {
      urls: composeAssetUrls(appid, row?.headerPath, row?.assetTimestamp, "header.jpg"),
      params: { width: 231, height: 87, fit: "cover", quality: 85 },
    };
  }

  // Native-resolution sibling of `capsule`. Same `header.jpg` source (460×215,
  // Steam's max for the logo-bearing key art) served at full width instead of
  // cropped down to the 231×87 list thumbnail. For hero-sized tiles — the
  // wishlist profile chip renders this asset ~460px wide, where the small
  // capsule visibly upscales. No `fit: 'cover'`: header's 2.14:1 aspect already
  // matches the tile, so the frontend `object-cover` is a no-op crop.
  async capsuleLarge(appid: number): Promise<Resolved> {
    const row = await this.resolveAssetRow(appid);
    return {
      urls: composeAssetUrls(appid, row?.headerPath, row?.assetTimestamp, "header.jpg"),
      params: { width: 460, quality: 88 },
    };
  }

  async libraryCapsule(appid: number): Promise<Resolved> {
    const row = await this.resolveAssetRow(appid);
    return {
      urls: composeAssetUrls(
        appid,
        row?.libraryCapsulePath,
        row?.assetTimestamp,
        "library_600x900.jpg"
      ),
      params: { width: 300, quality: 85 },
    };
  }

  async hero(appid: number): Promise<Resolved> {
    const row = await this.resolveAssetRow(appid);
    // Chain: hashed library_hero → legacy library_hero.jpg → hashed
    // header.jpg → legacy header.jpg. The header tier covers wishlist
    // titles whose publishers haven't shipped any library_* asset yet
    // (Townfall-shape: header is the only canonical art). For owned
    // games the legacy library_hero entry 200s first and the header
    // tier is never reached, so this adds no upstream calls in the
    // common path.
    return {
      urls: [
        ...composeAssetUrls(
          appid,
          row?.libraryHeroPath,
          row?.assetTimestamp,
          "library_hero.jpg"
        ),
        ...composeAssetUrls(appid, row?.headerPath, row?.assetTimestamp, "header.jpg"),
      ],
      // `enlarge: true` lets Sharp upscale the 460-wide header source to
      // 1280 when it's the only available banner. For 1920-wide
      // library_hero sources the resize is still a downscale, so this
      // flag is a no-op on the common path. No `fit: 'cover'` — header
      // and hero have different aspect ratios (2.14:1 vs 3.1:1); the
      // frontend's `object-cover` on the row img handles the crop.
      params: { width: 1280, quality: 85, enlarge: true },
    };
  }

  // High-resolution variant of `hero` for full-bleed surfaces (the landing
  // page's Steam subject chapter, the Steam profile backdrop's destination
  // mount on wide viewports). Prefers `library_hero_2x.jpg` — Steam's 2x
  // asset, typically 3840×1240 native — and clamps to 2560×… so we don't
  // ship native bytes at every viewport. Falls through to the 1x hero if
  // 2x is missing (publishers don't always upload it).
  //
  // SteamGridDB community art is the first entry in the chain when present.
  // SGDB only stores a URL when the publisher's `library_hero_2x.jpg` is
  // missing (see SteamGridDbService.backfillMissingHeroes), so the two
  // sources are mutually exclusive in practice — for games with a real 2x
  // asset, `sgdbHeroUrl` is null and the chain behaves as before.
  //
  // Distinct from `hero` so library tiles, hovercards, and the game-detail
  // page keep their 1280-wide bytes; chapter surfaces opt into the heavier
  // payload by hitting this route explicitly.
  async heroLarge(appid: number): Promise<Resolved> {
    const row = await this.resolveAssetRow(appid);
    // Three-tier fallback: SGDB community art → hashed 2x → legacy 2x →
    // hashed 1x → legacy 1x → hashed header → legacy header.jpg. SGDB
    // entries are populated by the backfill script (separate target for
    // owned vs wishlist appids) and only land when the publisher's hero
    // is missing. The header tier is for wishlist titles whose publishers
    // only shipped the header asset (Townfall-shape); owned games 200 on
    // the legacy 1x entry before reaching it.
    const twoX = composeAssetUrls(
      appid,
      row?.libraryHero2xPath,
      row?.assetTimestamp,
      "library_hero_2x.jpg"
    );
    const oneX = composeAssetUrls(
      appid,
      row?.libraryHeroPath,
      row?.assetTimestamp,
      "library_hero.jpg"
    );
    const header = composeAssetUrls(
      appid,
      row?.headerPath,
      row?.assetTimestamp,
      "header.jpg"
    );
    const sgdb = row?.sgdbHeroUrl ? [row.sgdbHeroUrl] : [];
    return {
      urls: [...sgdb, ...twoX, ...oneX, ...header],
      // Stays at default `withoutEnlargement: true` — Sharp returns the
      // native source dimensions if smaller than 2560. We tried an `enlarge:
      // true + sharpen({ sigma: 0.6–1.2 })` pass to recover apparent crispness
      // for publishers without a 2x asset (RE3-shaped: 1920w-only). The bytes
      // barely moved (158→179 KB at sigma 1.2 vs 158 KB at sigma 0.6) because
      // the source is information-poor (dark JPEG hero art, minimal high-
      // frequency content) and WebP correctly recognises upscaled regions as
      // redundant. The `enlarge`/`sharpen` primitives are still wired into
      // `transcodeToWebp` for any future route where the tradeoff is worth it.
      params: { width: 2560, quality: 90 },
    };
  }

  async logo(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { logoPath: true },
    });
    return {
      urls: composeAssetUrls(appid, row?.logoPath, null, "logo.png"),
      // `trim: true` strips transparent padding from the upstream PNG before
      // resize, normalising the displayed size across publishers. Without
      // this, logos with built-in 30%+ alpha padding (NieR Replicant,
      // Cyberpunk's compact wordmark, AI:LIMIT) render visibly smaller than
      // tightly-cropped ones (RE2, Wuchang) under the same `max-h`/`max-w`
      // constraints on the frontend.
      params: { width: 480, trim: true },
    };
  }

  // Profile page backdrop. Chain in preference order:
  //   1. `library_hero.jpg` (+ hashed variant when enrichment knows the
  //      content hash) — modern titles' wide hero art (1920×620). It IS
  //      the same asset the destination renders in the hero banner; the
  //      page-wide layer applies heavy blur (~20px) + scale + dim wash
  //      so it reads as ambient palette wash rather than a visible echo.
  //      Steam's own client does the same thing on the library home.
  //   2. `page_bg_generated.jpg` — older titles (pre-2019 library asset
  //      spec), warmer/saturated; preferred over v6b because v6b is
  //      tinted blue + low-saturation enough to read as "washed out".
  //   3. `page_bg_generated_v6b.jpg` — modern titles without library_hero
  //      (rare), blue last-resort.
  //   4. `storepagebackground/app/{appid}` — universal mirror.
  // Also used as the fallback when a title is missing `library_hero.jpg`
  // entirely (frontend chains hero → backdrop via onError on the
  // destination, row shell, and tile's hidden morph anchor). In that
  // case the chain effectively starts at entry 2 since entry 1 just 404s
  // for that subset.
  async backdrop(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { libraryHeroPath: true, assetTimestamp: true },
    });
    const t = row?.assetTimestamp != null ? `?t=${row.assetTimestamp.toString()}` : "";
    const heroUrls = composeAssetUrls(
      appid,
      row?.libraryHeroPath,
      row?.assetTimestamp,
      "library_hero.jpg"
    );
    return {
      urls: [
        ...heroUrls,
        `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/page_bg_generated.jpg${t}`,
        `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/page_bg_generated_v6b.jpg${t}`,
        `${STEAM_STORE_BG_HOST}/images/storepagebackground/app/${appid}${t}`,
      ],
      params: { quality: 95 },
    };
  }

  async achievement(appid: number, apiName: string): Promise<Resolved> {
    const row = await this.prisma.steamGameAchievement.findUnique({
      where: { appid_apiName: { appid, apiName } },
      select: { iconUrl: true },
    });
    if (!row) {
      throw new NotFoundException(`SteamGameAchievement(${appid}, ${apiName}) not found`);
    }
    return {
      urls: [row.iconUrl],
      params: { width: 64, quality: 85 },
    };
  }

  async achievementGray(appid: number, apiName: string): Promise<Resolved> {
    const row = await this.prisma.steamGameAchievement.findUnique({
      where: { appid_apiName: { appid, apiName } },
      select: { iconGrayUrl: true },
    });
    if (!row) {
      throw new NotFoundException(`SteamGameAchievement(${appid}, ${apiName}) not found`);
    }
    return {
      urls: [row.iconGrayUrl],
      params: { width: 64, quality: 85 },
    };
  }
}
