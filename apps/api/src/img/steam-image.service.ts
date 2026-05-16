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

  // 231×87 cover capsule. Sourced from `header.jpg` (460×215) and Sharp-
  // cropped to the canonical cover ratio. `libraryCapsule` is the separate
  // 600×900 portrait — different asset, different route.
  async capsule(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { headerPath: true, assetTimestamp: true },
    });
    return {
      urls: composeAssetUrls(appid, row?.headerPath, row?.assetTimestamp, "header.jpg"),
      params: { width: 231, height: 87, fit: "cover", quality: 85 },
    };
  }

  async libraryCapsule(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { libraryCapsulePath: true, assetTimestamp: true },
    });
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
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { libraryHeroPath: true, assetTimestamp: true },
    });
    return {
      urls: composeAssetUrls(
        appid,
        row?.libraryHeroPath,
        row?.assetTimestamp,
        "library_hero.jpg"
      ),
      params: { width: 1280, quality: 85 },
    };
  }

  async logo(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { logoPath: true },
    });
    return {
      urls: composeAssetUrls(appid, row?.logoPath, null, "logo.png"),
      params: { width: 480 },
    };
  }

  // Profile page backdrop. `page_bg_generated_v6b.jpg` is the high-quality
  // (less aggressively compressed) variant under `store_item_assets`; not
  // universally present, so we fall back to `storepagebackground/app/{appid}`
  // on a different host — universally available across the titles sampled.
  async backdrop(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { assetTimestamp: true },
    });
    const t = row?.assetTimestamp != null ? `?t=${row.assetTimestamp.toString()}` : "";
    return {
      urls: [
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
