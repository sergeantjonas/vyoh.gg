import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Global, Module } from "@nestjs/common";
import { IdentityController } from "./identity.controller";
import {
  ACCOUNTS_CONFIG,
  type AccountsConfig,
  IdentityService,
} from "./identity.service";

function loadAccountsConfig(): AccountsConfig {
  const path = join(process.cwd(), "accounts.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

@Global()
@Module({
  controllers: [IdentityController],
  providers: [
    IdentityService,
    { provide: ACCOUNTS_CONFIG, useFactory: loadAccountsConfig },
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
