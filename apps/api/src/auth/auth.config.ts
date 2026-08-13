export const AUTH_CONFIG = Symbol("AUTH_CONFIG");

export type AuthConfig = {
  /** The one identity allowed to hold an owner session. */
  ownerGithubUserId: number;
  clientId: string;
  clientSecret: string;
  /** HMAC key for the OAuth state token. Session ids are random, not signed. */
  sessionSecret: string;
  /** Unset unless api and web split subdomains — a Domain on a localhost cookie stops it being sent. */
  cookieDomain: string | undefined;
  /** Absolute origin the callback redirects back to; dev splits web (:2009) from api (:2010). */
  webOrigin: string;
  secureCookies: boolean;
};

export function resolveAuthConfig(env: NodeJS.ProcessEnv, webOrigin: string): AuthConfig {
  const ownerGithubUserId = Number(env.OWNER_GITHUB_USER_ID);
  // A username here instead of the numeric id would parse as NaN and match
  // nobody, which fails safe — but it fails silently at login rather than at
  // boot, so name the mistake while the stack trace still points at the cause.
  if (!Number.isInteger(ownerGithubUserId) || ownerGithubUserId <= 0) {
    throw new Error(
      `OWNER_GITHUB_USER_ID must be a positive integer (GitHub's numeric user id, not the login). Got: ${env.OWNER_GITHUB_USER_ID}`
    );
  }

  return {
    ownerGithubUserId,
    clientId: env.GITHUB_OAUTH_CLIENT_ID ?? "",
    clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET ?? "",
    sessionSecret: env.SESSION_SECRET ?? "",
    cookieDomain: env.SESSION_COOKIE_DOMAIN || undefined,
    webOrigin,
    secureCookies: env.NODE_ENV === "production",
  };
}
