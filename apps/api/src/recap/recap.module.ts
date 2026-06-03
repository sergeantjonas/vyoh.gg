import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { SteamModule } from "../steam/steam.module";
import { LolMomentsService } from "./lol-moments.service";
import { RecapSubjectsService } from "./recap-subjects.service";
import { RecapController } from "./recap.controller";
import { SteamMomentsService } from "./steam-moments.service";

@Module({
  imports: [PrismaModule, SteamModule],
  controllers: [RecapController],
  providers: [RecapSubjectsService, LolMomentsService, SteamMomentsService],
})
export class RecapModule {}
