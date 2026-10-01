import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { RumBeaconDto } from "./rum.dto";
import { RumService } from "./rum.service";

@Controller("rum")
export class RumController {
  constructor(private readonly rum: RumService) {}

  // Anonymous by design: every visitor's browser posts here. What bounds it is
  // the DTO, the body limit in `beacon-body.middleware.ts`, and the
  // `vyoh_api_rum` zone in deploy/nginx.
  @Post()
  @HttpCode(204)
  async ingest(@Body() beacon: RumBeaconDto): Promise<void> {
    await this.rum.record(beacon);
  }
}
