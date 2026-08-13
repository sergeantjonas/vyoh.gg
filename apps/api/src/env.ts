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
  const origins = splitOrigins(value);
  return origins.length > 0 ? origins : LOCALHOST_ORIGINS;
}

/** Where the Vite dev server runs — the api is on :2010, so a relative redirect misses it. */
const DEV_WEB_ORIGIN = "http://localhost:2009";

/**
 * The absolute origin to send a browser back to after an OAuth round-trip.
 *
 * In production api and web share one host behind nginx, so this is the site
 * itself and the first `WEB_ORIGIN` entry is it (apex first, `www` second, by
 * convention of how the var is written). In dev they are different ports, so a
 * relative `Location: /status` would land on the api's own status endpoint
 * rather than the page.
 */
export function resolveWebOrigin(value: string | undefined): string {
  return splitOrigins(value)[0] ?? DEV_WEB_ORIGIN;
}

function splitOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
