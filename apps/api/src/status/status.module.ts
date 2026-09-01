import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LolModule } from "../lol/lol.module";
import { RiotModule } from "../riot/riot.module";
import { SyncJobsModule } from "../sync-jobs/sync-jobs.module";
import { StatusController } from "./status.controller";

// `AuthModule` for `OwnerGuard` on the sync writes — Nest resolves a
// guard's own dependencies (here `AuthService`) from the module that declares
// the guarded controller, so importing it is what makes the decorator work.
@Module({
  imports: [RiotModule, LolModule, AuthModule, SyncJobsModule],
  controllers: [StatusController],
})
export class StatusModule {}
