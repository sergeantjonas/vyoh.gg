export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

/**
 * Any localhost port. Dev serves the app on :2009 and probes bind ephemeral
 * ports, so pinning one number would break both.
 */
const LOCALHOST_ORIGINS = /^http:\/\/localhost:\d+$/;

/**
 * Resolve `WEB_ORIGIN` into what `enableCors` wants.
 *
 * The value is a comma-separated list of absolute origins, because apex and
 * `www` are two origins to a browser even when Nginx serves them as one site.
 * Unset, this falls back to the dev localhost pattern — which is why
 * `bootstrap` requires the var under `NODE_ENV=production`: without that gate,
 * a deploy that forgot to set it would come up looking healthy and only fail
 * once a browser made the first cross-origin request.
 */
export function resolveCorsOrigin(value: string | undefined): string[] | RegExp {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : LOCALHOST_ORIGINS;
}
