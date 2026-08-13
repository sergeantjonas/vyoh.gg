import { Controller, Get, Header, Inject, Post, Query, Req, Res } from "@nestjs/common";
import type { Viewer } from "@vyoh/shared";
import type { Request, Response } from "express";
import { GithubCallbackQueryDto, LoginQueryDto } from "./auth-query.dto";
import { AUTH_CONFIG, type AuthConfig } from "./auth.config";
import { AuthService, SESSION_TTL_MS } from "./auth.service";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  cookieOptions,
  parseCookieHeader,
} from "./cookies";
import {
  DEFAULT_NEXT,
  STATE_TTL_MS,
  newNonce,
  safeNextPath,
  signState,
  verifyState,
} from "./oauth-state";

/** Why a login round-trip ended early. Read by the web `/login` page, never by a guard. */
type DenyReason = "state" | "github" | "forbidden";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  @Get("github/login")
  login(@Query() query: LoginQueryDto, @Res() res: Response): void {
    const nonce = newNonce();
    const state = signState(
      { nonce, next: safeNextPath(query.next), exp: Date.now() + STATE_TTL_MS },
      this.config.sessionSecret
    );

    res.cookie(STATE_COOKIE, nonce, this.cookie(STATE_TTL_MS));
    res.redirect(this.auth.authorizeUrl(state));
  }

  @Get("github/callback")
  async callback(
    @Query() query: GithubCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const nonce = parseCookieHeader(req.headers.cookie)[STATE_COOKIE];
    // One-shot whatever happens next: a state cookie that survives a failed
    // attempt is a replay window.
    res.clearCookie(STATE_COOKIE, this.cookie(0));

    const claims = verifyState(query.state, this.config.sessionSecret, Date.now());
    // Nonce match is what pins this callback to the browser that started the
    // handshake — without it a signed state token from anywhere logs anyone in.
    if (claims === null || nonce === undefined || claims.nonce !== nonce) {
      return this.deny(res, "state", DEFAULT_NEXT);
    }
    // GitHub sends `?error=access_denied` instead of a code when authorisation
    // is declined; there is nothing to exchange.
    if (query.error !== undefined || !query.code) {
      return this.deny(res, "github", claims.next);
    }

    const identity = await this.auth.exchangeCode(query.code);
    if (identity === null) return this.deny(res, "github", claims.next);
    if (!this.auth.isOwner(identity)) return this.deny(res, "forbidden", claims.next);

    const { token } = await this.auth.createSession(identity, new Date());
    res.cookie(SESSION_COOKIE, token, this.cookie(SESSION_TTL_MS));
    res.redirect(`${this.config.webOrigin}${claims.next}`);
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = parseCookieHeader(req.headers.cookie)[SESSION_COOKIE];
    await this.auth.revokeSession(token);
    res.clearCookie(SESSION_COOKIE, this.cookie(0));
    res.status(204).end();
  }

  /**
   * Who is looking. Answers 200 for everyone — being logged out is this
   * endpoint's normal case, not an error, and a 401 would make React Query
   * treat every anonymous page view as a failed request.
   */
  @Get("viewer")
  @Header("Cache-Control", "no-store")
  async viewer(@Req() req: Request): Promise<Viewer> {
    const token = parseCookieHeader(req.headers.cookie)[SESSION_COOKIE];
    const owner = await this.auth.resolveOwner(token, new Date());
    return owner === null ? { isOwner: false } : { isOwner: true, login: owner.login };
  }

  private deny(res: Response, reason: DenyReason, next: string): void {
    const params = new URLSearchParams({ error: reason, next });
    res.redirect(`${this.config.webOrigin}/login?${params.toString()}`);
  }

  private cookie(maxAgeMs: number) {
    return cookieOptions(maxAgeMs, this.config.secureCookies, this.config.cookieDomain);
  }
}
