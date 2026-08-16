import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  AdminLolAccount,
  AdminLolAccountDeleteResult,
  AdminPurgePreview,
  AdminPurgeResult,
} from "@vyoh/shared";
import { OwnerGuard } from "../auth/owner.guard";
import {
  CreateLolAccountDto,
  DeleteLolAccountQueryDto,
  LolAccountSlugParamDto,
  PurgeLolAccountDto,
  UpdateLolAccountDto,
} from "./admin-accounts.dto";
import { AdminAccountsService } from "./admin-accounts.service";

/**
 * Every route here is owner-only, reads included — the two timestamps this
 * surface exists to show are exactly what `/me` withholds from the public
 * projection, and a roster's pause state is ops detail rather than something a
 * visitor is owed. Each carries its own `@UseGuards` rather than one decorator
 * on the class, matching the per-route posture `OwnerGuard` documents: on a
 * site that is public by design, a gate should read as a deliberate exception at
 * the definition it applies to. `conventions.spec.ts` pins all four by name.
 *
 * League only, by design. `SteamAccount` exists as a table but no read path
 * consults it — every Steam surface resolves the owner from `STEAM_OWNER_ID` in
 * `steam.config.ts` — so roster endpoints for it would write rows nobody reads.
 */
@Controller("admin")
export class AdminAccountsController {
  constructor(private readonly admin: AdminAccountsService) {}

  @Get("lol-accounts")
  @UseGuards(OwnerGuard)
  listLolAccounts(): Promise<AdminLolAccount[]> {
    return this.admin.listLolAccounts();
  }

  @Post("lol-accounts")
  @UseGuards(OwnerGuard)
  createLolAccount(@Body() dto: CreateLolAccountDto): Promise<AdminLolAccount> {
    return this.admin.createLolAccount(dto);
  }

  @Patch("lol-accounts/:slug")
  @UseGuards(OwnerGuard)
  updateLolAccount(
    @Param() { slug }: LolAccountSlugParamDto,
    @Body() dto: UpdateLolAccountDto
  ): Promise<AdminLolAccount> {
    return this.admin.updateLolAccount(slug, dto);
  }

  @Delete("lol-accounts/:slug")
  @UseGuards(OwnerGuard)
  deleteLolAccount(
    @Param() { slug }: LolAccountSlugParamDto,
    @Query() { force }: DeleteLolAccountQueryDto
  ): Promise<AdminLolAccountDeleteResult> {
    return this.admin.deleteLolAccount(slug, force === "true");
  }

  /**
   * Purge is a second route rather than `DELETE …?purge=true`, and the two
   * verbs are not interchangeable. `DELETE` un-tracks an account and strands
   * its history; this erases the history. A query param on the milder one would
   * put both behind a string that is easy to append while debugging and easy to
   * miss while reading — a distinct path has to be typed on purpose.
   */
  @Get("lol-accounts/:slug/purge-preview")
  @UseGuards(OwnerGuard)
  purgePreview(@Param() { slug }: LolAccountSlugParamDto): Promise<AdminPurgePreview> {
    return this.admin.purgePreview(slug);
  }

  @Post("lol-accounts/:slug/purge")
  @UseGuards(OwnerGuard)
  purgeLolAccount(
    @Param() { slug }: LolAccountSlugParamDto,
    @Body() { confirm }: PurgeLolAccountDto
  ): Promise<AdminPurgeResult> {
    return this.admin.purgeAccount(slug, confirm);
  }
}
