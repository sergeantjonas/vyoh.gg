import { Controller, Get, Header, HttpStatus, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  type ChampionVariant,
  LolImageService,
  ROLE_POSITION_SLUGS,
  type RolePositionSlug,
} from "./lol-image.service";
import { SteamImageService } from "./steam-image.service";
import {
  type TranscodeParams,
  UpstreamError,
  fetchUpstream,
  fetchUpstreamChain,
  transcodeToWebp,
} from "./upstream";

const IMMUTABLE_YEAR = "public, max-age=31536000, immutable";

const CHAMPION_VARIANTS = new Set<ChampionVariant>(["square", "card", "backdrop"]);
const ROLE_POSITIONS = new Set<RolePositionSlug>(ROLE_POSITION_SLUGS);

@Controller("img")
export class ImgController {
  constructor(
    private readonly lol: LolImageService,
    private readonly steam: SteamImageService
  ) {}

  // LoL champion icon/splash variants. `:patch` is a browser cache key only —
  // the proxy ignores its value because CDragon serves "latest" under a single
  // stable URL. Future Riot CDN swaps shift the cached file under the same key.
  @Get("lol/champion/:alias/:variant/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async champion(
    @Param("alias") alias: string,
    @Param("variant") variant: string,
    @Res() res: Response
  ): Promise<void> {
    if (!CHAMPION_VARIANTS.has(variant as ChampionVariant)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = this.lol.champion(alias, variant as ChampionVariant);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("lol/item/:itemId/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async item(
    @Param("itemId") itemId: string,
    @Param("patch") patch: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(itemId, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = this.lol.item(id, patch);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("lol/rune/:keystoneId/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async rune(
    @Param("keystoneId") keystoneId: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(keystoneId, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.lol.rune(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("lol/spell/:spellKey/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async spell(@Param("spellKey") spellKey: string, @Res() res: Response): Promise<void> {
    const key = Number.parseInt(spellKey, 10);
    if (!Number.isFinite(key)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.lol.spell(key);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Role-position SVG pass-through. Versionless — CDragon's role-position SVGs
  // change too rarely to warrant a cache-key segment, and the SVG is small
  // enough that any revalidation cost is negligible.
  @Get("lol/role/:position.svg")
  @Header("Content-Type", "image/svg+xml")
  @Header("Cache-Control", "public, max-age=86400")
  async role(@Param("position") position: string, @Res() res: Response): Promise<void> {
    if (!ROLE_POSITIONS.has(position as RolePositionSlug)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const url = this.lol.roleIconUrl(position as RolePositionSlug);
    try {
      const svg = await fetchUpstream(url);
      res.send(svg);
    } catch (err) {
      if (err instanceof UpstreamError) {
        res.status(HttpStatus.BAD_GATEWAY).send();
        return;
      }
      throw err;
    }
  }

  @Get("steam/capsule/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamCapsule(@Param("appid") appid: string, @Res() res: Response): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.capsule(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/library-capsule/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamLibraryCapsule(
    @Param("appid") appid: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.libraryCapsule(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/hero/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamHero(@Param("appid") appid: string, @Res() res: Response): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.hero(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/logo/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamLogo(@Param("appid") appid: string, @Res() res: Response): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.logo(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/backdrop/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamBackdrop(
    @Param("appid") appid: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.backdrop(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/achievement/:appid/:apiName/:schemaVersion.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamAchievement(
    @Param("appid") appid: string,
    @Param("apiName") apiName: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.achievement(id, apiName);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/achievement-gray/:appid/:apiName/:schemaVersion.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamAchievementGray(
    @Param("appid") appid: string,
    @Param("apiName") apiName: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.achievementGray(id, apiName);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  private async proxyWebp(
    urls: string[],
    params: TranscodeParams,
    res: Response
  ): Promise<void> {
    try {
      const bytes = await fetchUpstreamChain(urls);
      const webp = await transcodeToWebp(bytes, params);
      res.send(webp);
    } catch (err) {
      if (err instanceof UpstreamError) {
        res.status(HttpStatus.BAD_GATEWAY).send();
        return;
      }
      throw err;
    }
  }
}
