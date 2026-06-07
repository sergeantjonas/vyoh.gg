import { Controller, Get, Header, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  OgChampionAliasDto,
  OgMatchParamsDto,
  OgSlugDto,
  OgSteamAppidDto,
} from "./og-params.dto";
import { OgService } from "./og.service";

// Shared cache header for every PNG endpoint. Aggressive shared-CDN cache
// (s-maxage 30d) + 24h browser cache. Per-entity URLs are stable; profile
// data may drift but `stale-while-revalidate` semantics on the shared cache
// absorb that. Re-evaluate per-endpoint if the profile OG ever surfaces fast-
// moving stats like live rank LP.
const OG_CACHE_HEADER = "public, max-age=86400, s-maxage=2592000";

@Controller("og")
export class OgController {
  constructor(private readonly og: OgService) {}

  @Get("match/:slug/:matchId.png")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", OG_CACHE_HEADER)
  async matchCard(
    @Param() { slug, matchId }: OgMatchParamsDto,
    @Res() res: Response
  ): Promise<void> {
    const png = await this.og.generateMatchCard(slug, matchId);
    res.send(png);
  }

  @Get("champion/:alias.png")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", OG_CACHE_HEADER)
  async championCard(
    @Param() { alias }: OgChampionAliasDto,
    @Res() res: Response
  ): Promise<void> {
    const png = await this.og.generateChampionCard(alias);
    res.send(png);
  }

  @Get("profile/:slug.png")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", OG_CACHE_HEADER)
  async profileCard(@Param() { slug }: OgSlugDto, @Res() res: Response): Promise<void> {
    const png = await this.og.generateProfileCard(slug);
    res.send(png);
  }

  @Get("home.png")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", OG_CACHE_HEADER)
  async homeCard(@Res() res: Response): Promise<void> {
    const png = await this.og.generateHomeCard();
    res.send(png);
  }

  @Get("steam-game/:appid.png")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", OG_CACHE_HEADER)
  async steamGameCard(
    @Param() { appid }: OgSteamAppidDto,
    @Res() res: Response
  ): Promise<void> {
    const png = await this.og.generateSteamGameCard(Number.parseInt(appid, 10));
    res.send(png);
  }
}
