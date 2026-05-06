import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { LolModule } from "./lol/lol.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RiotModule } from "./riot/riot.module";

@Module({
  imports: [PrismaModule, RiotModule, LolModule],
  controllers: [HealthController],
})
export class AppModule {}
