import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { SteamModule } from "../steam/steam.module";
import { RecapSubjectsService } from "./recap-subjects.service";
import { RecapController } from "./recap.controller";

@Module({
  imports: [PrismaModule, SteamModule],
  controllers: [RecapController],
  providers: [RecapSubjectsService],
})
export class RecapModule {}
