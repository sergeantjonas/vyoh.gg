import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common";
import { parseBeaconJson, readBeaconText } from "./beacon-body.middleware";
import { RumController } from "./rum.controller";
import { RumService } from "./rum.service";

@Module({
  controllers: [RumController],
  providers: [RumService],
})
export class RumModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(readBeaconText, parseBeaconJson)
      .forRoutes({ path: "rum", method: RequestMethod.POST });
  }
}
