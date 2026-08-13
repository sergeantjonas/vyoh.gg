import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_CONFIG, type AuthConfig } from "./auth.config";

/** Sliding window — extended on use so the owner is not logged out mid-week. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Hard ceiling. Never extended: one login must not become permanent access. */
export const SESSION_ABSOLUTE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Don't rewrite the expiry on every guarded request — only once the window has
 * actually drifted this far. Sliding expiry is a convenience, not an audit
 * trail, so a write per request would be pure cost.
 */
export const SESSION_EXTEND_AFTER_MS = 24 * 60 * 60 * 1000;

const GITHUB_TIMEOUT_MS = 10_000;

export type GithubIdentity = { id: number; login: string };

export type IssuedSession = { token: string; expiresAt: Date };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  /**
   * GitHub's authorize screen.
   *
   * No `scope`: `GET /user` returns the authorising account's id and login with
   * no scope granted at all, and that is the entire fact this app needs. No
   * `redirect_uri` either — omitted, GitHub uses the callback registered on the
   * OAuth app, so where the browser lands cannot be steered from a crafted link.
   */
  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      state,
      allow_signup: "false",
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange the callback `code` for the GitHub identity behind it.
   *
   * The access token is used once, here, and never persisted: the only fact we
   * need from GitHub is which account authorised, and re-deriving that is a
   * fresh login rather than a stored credential to protect.
   */
  async exchangeCode(code: string): Promise<GithubIdentity | null> {
    const accessToken = await this.requestAccessToken(code);
    if (accessToken === null) return null;
    return await this.requestIdentity(accessToken);
  }

  isOwner(identity: GithubIdentity): boolean {
    return identity.id === this.config.ownerGithubUserId;
  }

  async createSession(identity: GithubIdentity, now: Date): Promise<IssuedSession> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        githubUserId: identity.id,
        githubLogin: identity.login,
        createdAt: now,
        expiresAt,
        absoluteExpiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS),
      },
    });

    return { token, expiresAt };
  }

  /**
   * Resolve a cookie value to the owner behind it, or null.
   *
   * Every failure mode collapses to null on purpose: the caller has one
   * decision to make, and distinguishing "no such session" from "expired" from
   * "not the owner" in the response only tells an attacker which half of a
   * guess was right.
   */
  async resolveOwner(
    token: string | undefined,
    now: Date
  ): Promise<GithubIdentity | null> {
    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (session === null) return null;

    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      // Reap on read. Expired rows are worthless and this is the only moment
      // we know one exists without scanning for it — cheaper than a cron.
      await this.deleteByHash(tokenHash);
      return null;
    }

    // A session predating an owner change — or minted before this config — is
    // not the owner's, whatever the row says.
    if (session.githubUserId !== this.config.ownerGithubUserId) return null;

    await this.extendIfStale(
      session.tokenHash,
      session.expiresAt,
      session.absoluteExpiresAt,
      now
    );
    return { id: session.githubUserId, login: session.githubLogin };
  }

  /** Idempotent: logging out twice, or with a stale cookie, is a success. */
  async revokeSession(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.deleteByHash(hashToken(token));
  }

  private async extendIfStale(
    tokenHash: string,
    expiresAt: Date,
    absoluteExpiresAt: Date,
    now: Date
  ): Promise<void> {
    const extended = new Date(now.getTime() + SESSION_TTL_MS);
    if (extended.getTime() - expiresAt.getTime() < SESSION_EXTEND_AFTER_MS) return;

    // The sliding window may never outrun the ceiling — that is the whole
    // reason the ceiling exists.
    const capped = extended > absoluteExpiresAt ? absoluteExpiresAt : extended;
    await this.prisma.session.update({
      where: { tokenHash },
      data: { expiresAt: capped },
    });
  }

  private async deleteByHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  private async requestAccessToken(code: string): Promise<string | null> {
    const response = await this.postJson("https://github.com/login/oauth/access_token", {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
    });
    if (response === null) return null;

    // GitHub answers 200 with `{ error }` for a bad or replayed code rather
    // than a 4xx, so the status alone does not tell us the exchange worked.
    const token = (response as { access_token?: unknown }).access_token;
    if (typeof token !== "string" || token === "") {
      this.logger.warn(
        `GitHub rejected the code exchange: ${String((response as { error?: unknown }).error ?? "no access_token in response")}`
      );
      return null;
    }
    return token;
  }

  private async requestIdentity(accessToken: string): Promise<GithubIdentity | null> {
    let response: Response;
    try {
      response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`GitHub user lookup failed: ${describeError(error)}`);
      return null;
    }

    if (!response.ok) {
      this.logger.error(`GitHub user lookup returned ${response.status}`);
      return null;
    }

    const body = (await response.json()) as { id?: unknown; login?: unknown };
    if (typeof body.id !== "number" || typeof body.login !== "string") return null;
    return { id: body.id, login: body.login };
  }

  private async postJson(
    url: string,
    body: Record<string, string>
  ): Promise<unknown | null> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.error(`GitHub token exchange returned ${response.status}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      // Never log `body` — it carries the client secret and the code.
      this.logger.error(`GitHub token exchange failed: ${describeError(error)}`);
      return null;
    }
  }
}

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
