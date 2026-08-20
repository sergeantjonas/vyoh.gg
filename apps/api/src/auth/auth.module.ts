import { Module } from "@nestjs/common";
import { resolveWebOrigin } from "../env";
import { AUTH_CONFIG, resolveAuthConfig } from "./auth.config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OwnerGuard } from "./owner.guard";
import { ViewerGuard } from "./viewer";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OwnerGuard,
    ViewerGuard,
    {
      provide: AUTH_CONFIG,
      useFactory: () =>
        resolveAuthConfig(process.env, resolveWebOrigin(process.env.WEB_ORIGIN)),
    },
  ],
  // Both guards inject `AuthService`, so any module using one needs it too.
  exports: [AuthService, OwnerGuard, ViewerGuard],
})
export class AuthModule {}
