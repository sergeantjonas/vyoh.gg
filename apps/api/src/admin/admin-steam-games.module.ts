import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SteamModule } from "../steam/steam.module";
import { AdminSteamGamesController } from "./admin-steam-games.controller";
import { AdminSteamGamesService } from "./admin-steam-games.service";

// Its own module rather than a second controller on `AdminAccountsModule`: that
// one is a roster surface and pulls in `RiotModule` for the account-v1 check on
// create, which this has no use for.
//
// `AuthModule` for `OwnerGuard` — Nest resolves a guard's dependencies from the
// module declaring the guarded controller. `SteamModule` for
// `SteamGameCurationService`, whose cache every write here has to invalidate.
@Module({
  imports: [AuthModule, SteamModule],
  controllers: [AdminSteamGamesController],
  providers: [AdminSteamGamesService],
})
export class AdminSteamGamesModule {}
