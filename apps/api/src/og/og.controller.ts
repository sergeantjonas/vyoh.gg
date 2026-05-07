import { Controller, Get, Header, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { OgService } from "./og.service";

@Controller("og")
export class OgController {
  constructor(private readonly og: OgService) {}

  @Get("match/:slug/:matchId.png")
  @Header("Content-Type", "image/png")
  @Header("Cache-Control", "public, max-age=86400, s-maxage=2592000")
  async matchCard(
    @Param("slug") slug: string,
    @Param("matchId") matchId: string,
    @Res() res: Response
  ): Promise<void> {
    const png = await this.og.generateMatchCard(slug, matchId);
    res.send(png);
  }
}
