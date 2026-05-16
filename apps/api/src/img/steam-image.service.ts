import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Resolved } from "./lol-image.service";

const STEAM_CDN_HOST = "https://shared.akamai.steamstatic.com";
const STEAM_STORE_ASSETS_PATH = "store_item_assets";

function composeAssetUrl(
  appid: number,
  hashedPath: string | null,
  timestamp: bigint | null,
  legacyFilename: string
): string {
  if (hashedPath) {
    const t = timestamp != null ? `?t=${timestamp.toString()}` : "";
    return `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/${hashedPath}${t}`;
  }
  return `${STEAM_CDN_HOST}/${STEAM_STORE_ASSETS_PATH}/steam/apps/${appid}/${legacyFilename}`;
}

@Injectable()
export class SteamImageService {
  constructor(private readonly prisma: PrismaService) {}

  async capsule(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { libraryCapsulePath: true, assetTimestamp: true },
    });
    if (!row) throw new NotFoundException(`SteamGameEnrichment(${appid}) not found`);
    return {
      url: composeAssetUrl(
        appid,
        row.libraryCapsulePath,
        row.assetTimestamp,
        "header.jpg"
      ),
      params: { width: 231, quality: 85 },
    };
  }

  async hero(appid: number): Promise<Resolved> {
    const row = await this.prisma.steamGameEnrichment.findUnique({
      where: { appid },
      select: { libraryHeroPath: true, assetTimestamp: true },
    });
    if (!row) throw new NotFoundException(`SteamGameEnrichment(${appid}) not found`);
    return {
      url: composeAssetUrl(
        appid,
        row.libraryHeroPath,
        row.assetTimestamp,
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
    if (!row) throw new NotFoundException(`SteamGameEnrichment(${appid}) not found`);
    return {
      url: composeAssetUrl(appid, row.logoPath, null, "logo.png"),
      params: { width: 480 },
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
      url: row.iconUrl,
      params: { width: 64, quality: 85 },
    };
  }
}
