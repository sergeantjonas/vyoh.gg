import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import type {
  AdminSteamGame,
  AdminSteamGameList,
  AdminSteamReviewCount,
} from "@vyoh/shared";
import { OwnerGuard } from "../auth/owner.guard";
import { UpdateSteamGameCurationDto } from "./admin-steam-games.dto";
import { AdminSteamGamesService } from "./admin-steam-games.service";

/**
 * Write surface for the Steam curation overlay — which games are private, and
 * which are merely not chapter material. The read side of the same data is not
 * here: the overlay's *effect* is baked into the public Steam endpoints, and
 * this controller is the only place its contents are enumerated.
 *
 * Owner-only throughout, reads included, and for a sharper reason than the
 * roster's: a list of the games the owner hid is exactly the secret the feature
 * exists to keep. `no-store` for the same reason — a cached copy of this
 * response is a cached copy of that list.
 *
 * Each route carries its own `@UseGuards` rather than one decorator on the
 * class, matching the per-route posture `OwnerGuard` documents.
 */
@Controller("admin/steam-games")
export class AdminSteamGamesController {
  constructor(private readonly admin: AdminSteamGamesService) {}

  @Get()
  @UseGuards(OwnerGuard)
  @Header("Cache-Control", "no-store")
  list(): Promise<AdminSteamGameList> {
    return this.admin.list();
  }

  /**
   * Split out from the list so the owner-visible review badge — which fires on
   * every page view, on every route — costs one cached integer instead of the
   * whole overlay plus a name join.
   */
  @Get("review-count")
  @UseGuards(OwnerGuard)
  @Header("Cache-Control", "no-store")
  reviewCount(): Promise<AdminSteamReviewCount> {
    return this.admin.reviewCount();
  }

  @Patch(":appid")
  @UseGuards(OwnerGuard)
  @Header("Cache-Control", "no-store")
  update(
    @Param("appid", ParseIntPipe) appid: number,
    @Body() dto: UpdateSteamGameCurationDto
  ): Promise<AdminSteamGame> {
    return this.admin.update(appid, dto);
  }

  @Delete(":appid")
  @UseGuards(OwnerGuard)
  @Header("Cache-Control", "no-store")
  @HttpCode(204)
  remove(@Param("appid", ParseIntPipe) appid: number): Promise<void> {
    return this.admin.remove(appid);
  }
}
