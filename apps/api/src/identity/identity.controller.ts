import { Controller, Get } from "@nestjs/common";
import type { Me } from "@vyoh/shared";
import { IdentityService } from "./identity.service";

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get("me")
  async getMe(): Promise<Me> {
    return {
      lol: await this.identity.getLolAccountsWithSummary(),
      steam: this.identity.getSteamIds(),
    };
  }
}
