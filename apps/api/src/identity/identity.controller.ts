import { Controller, Get } from "@nestjs/common";
import type { Me } from "@vyoh/shared";
import { IdentityService } from "./identity.service";

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get("me")
  getMe(): Me {
    return {
      lol: this.identity.getLolAccounts(),
      steam: this.identity.getSteamIds(),
    };
  }
}
