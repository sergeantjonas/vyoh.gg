import { Module } from "@nestjs/common";
import { resolveWebOrigin } from "../env";
import { AUTH_CONFIG, resolveAuthConfig } from "./auth.config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OwnerGuard } from "./owner.guard";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OwnerGuard,
    {
      provide: AUTH_CONFIG,
      useFactory: () =>
        resolveAuthConfig(process.env, resolveWebOrigin(process.env.WEB_ORIGIN)),
    },
  ],
  // `OwnerGuard` injects `AuthService`, so any module gating a route needs both.
  exports: [AuthService, OwnerGuard],
})
export class AuthModule {}
