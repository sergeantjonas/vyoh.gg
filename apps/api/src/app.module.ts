import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { LolModule } from "./lol/lol.module";

@Module({
  imports: [LolModule],
  controllers: [HealthController],
})
export class AppModule {}
