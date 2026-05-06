import { Global, Module } from "@nestjs/common";
import accountsConfig from "../../accounts.json";
import { IdentityController } from "./identity.controller";
import { ACCOUNTS_CONFIG, IdentityService } from "./identity.service";

@Global()
@Module({
  controllers: [IdentityController],
  providers: [IdentityService, { provide: ACCOUNTS_CONFIG, useValue: accountsConfig }],
  exports: [IdentityService],
})
export class IdentityModule {}
