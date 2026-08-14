import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RiotModule } from "../riot/riot.module";
import { AdminAccountsController } from "./admin-accounts.controller";
import { AdminAccountsService } from "./admin-accounts.service";

// `AuthModule` for `OwnerGuard` — Nest resolves a guard's own dependencies from
// the module declaring the guarded controller, so importing it is what makes the
// decorators work. `RiotModule` for the account-v1 check on create.
// `IdentityService` needs no import: `IdentityModule` is `@Global()`.
@Module({
  imports: [AuthModule, RiotModule],
  controllers: [AdminAccountsController],
  providers: [AdminAccountsService],
})
export class AdminAccountsModule {}
