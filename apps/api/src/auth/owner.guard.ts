import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE, parseCookieHeader } from "./cookies";

/**
 * Gate a route on holding a live owner session.
 *
 * Applied per route with `@UseGuards(OwnerGuard)`, never globally: on a site
 * that is public by design, every gated endpoint is a deliberate exception and
 * should read as one at its own definition. A global guard with an opt-out
 * list inverts that, and the failure mode of forgetting an entry flips from
 * "this route is open" to "the whole site 401s".
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = parseCookieHeader(request.headers.cookie)[SESSION_COOKIE];

    const owner = await this.auth.resolveOwner(token, new Date());
    if (owner === null) throw new UnauthorizedException("Owner session required");

    return true;
  }
}
