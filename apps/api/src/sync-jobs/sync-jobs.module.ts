import { Module } from "@nestjs/common";
import { SyncJobRegistry } from "./sync-job-registry.service";

// Declared once and exported, so every importer shares the one registry
// instance. Re-declaring it in a consumer module would give that module its own
// copy — pollers would record into a registry the status controller never
// reads, and the board would sit permanently at "pending".
@Module({
  providers: [SyncJobRegistry],
  exports: [SyncJobRegistry],
})
export class SyncJobsModule {}
