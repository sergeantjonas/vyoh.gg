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
  AdminSteamAccount,
  AdminSteamAccountDeleteResult,
} from "@vyoh/shared";
import { OwnerGuard } from "../auth/owner.guard";
import {
  CreateLolAccountDto,
  CreateSteamAccountDto,
  DeleteLolAccountQueryDto,
  LolAccountSlugParamDto,
  SteamAccountIdParamDto,
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
 * the definition it applies to. `conventions.spec.ts` pins all seven by name.
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

  @Get("steam-accounts")
  @UseGuards(OwnerGuard)
  listSteamAccounts(): Promise<AdminSteamAccount[]> {
    return this.admin.listSteamAccounts();
  }

  @Post("steam-accounts")
  @UseGuards(OwnerGuard)
  createSteamAccount(@Body() dto: CreateSteamAccountDto): Promise<AdminSteamAccount> {
    return this.admin.createSteamAccount(dto);
  }

  @Delete("steam-accounts/:steamId64")
  @UseGuards(OwnerGuard)
  deleteSteamAccount(
    @Param() { steamId64 }: SteamAccountIdParamDto
  ): Promise<AdminSteamAccountDeleteResult> {
    return this.admin.deleteSteamAccount(steamId64);
  }
}
