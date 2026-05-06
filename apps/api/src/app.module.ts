import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { IdentityModule } from "./identity/identity.module";
import { LolModule } from "./lol/lol.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RiotModule } from "./riot/riot.module";

@Module({
  imports: [PrismaModule, IdentityModule, RiotModule, LolModule],
  controllers: [HealthController],
})
export class AppModule {}
