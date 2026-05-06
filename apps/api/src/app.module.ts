import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { LolModule } from "./lol/lol.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, LolModule],
  controllers: [HealthController],
})
export class AppModule {}
