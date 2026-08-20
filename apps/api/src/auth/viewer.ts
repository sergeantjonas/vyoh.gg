import {
  type CanActivate,
  type ExecutionContext,
  Header,
  Injectable,
  Logger,
  UseGuards,
  applyDecorators,
  createParamDecorator,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE, parseCookieHeader } from "./cookies";

/**
 * How the guard hands its answer to the param decorator. A param decorator
 * cannot inject a service — it receives only the `ExecutionContext` — and
 * resolving a session needs `AuthService`, so the work has to happen somewhere
 * that DI reaches and be left on the request for the decorator to pick up.
 */
type ViewerRequest = Request & { viewerIsOwner?: boolean };

/**
 * Resolves *who is asking* without gating on the answer. The opposite of
 * `OwnerGuard`: that one exists to reject, this one never does.
 *
 * It is a guard only because a guard is the earliest hook in the request
 * lifecycle that can inject `AuthService`. Nothing here decides access — the
 * routes that use it are public, and the owner simply gets a fuller answer.
 */
@Injectable()
export class ViewerGuard implements CanActivate {
  private readonly logger = new Logger(ViewerGuard.name);

  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ViewerRequest>();
    const token = parseCookieHeader(request.headers.cookie)[SESSION_COOKIE];

    try {
      request.viewerIsOwner = (await this.auth.resolveOwner(token, new Date())) !== null;
    } catch (error) {
      // A public read path must not fail because the session lookup did. If the
      // session table is unreachable the honest answer is "not the owner", which
      // serves the visitor's version of the page — degraded for the owner, still
      // correct for everyone, and never a 500 on a page that needs no login.
      request.viewerIsOwner = false;
      this.logger.warn(
        `Viewer resolution failed, serving the public projection: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return true;
  }
}

/**
 * `true` only when `ViewerGuard` has confirmed a live owner session.
 *
 * Absent the guard this reads `undefined` and yields `false`, so a route that
 * declares the parameter but forgets `@WithViewer()` serves the public
 * projection to everybody, including the owner. That is the right way round:
 * the mistake is visible to the one person who can fix it, and never leaks.
 */
export const ViewerIsOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): boolean =>
    context.switchToHttp().getRequest<ViewerRequest>().viewerIsOwner === true
);

/**
 * Marks a route whose body depends on who is asking.
 *
 * The `Cache-Control` is not decoration. Two viewers get different bytes from
 * one URL, so anything that may hold a shared copy — a proxy, a corporate
 * middlebox, a future CDN in front of the api — must be told not to. `private`
 * confines the copy to the requesting browser and `no-cache` makes that copy
 * revalidate, which is what keeps a game hidden a minute ago from being served
 * out of the owner's own history to a visitor on the same machine.
 *
 * Today nginx only caches `/img/*`, so nothing shared is actually at risk; the
 * header is here so that stays true when the caching layer changes.
 */
export function WithViewer() {
  return applyDecorators(
    UseGuards(ViewerGuard),
    Header("Cache-Control", "private, no-cache")
  );
}
