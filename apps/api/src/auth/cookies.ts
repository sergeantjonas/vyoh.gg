/** The owner's session. Opaque random value; the DB stores only its hash. */
export const SESSION_COOKIE = "vyoh_session";

/** Short-lived nonce that pins an OAuth callback to the browser that started it. */
export const STATE_COOKIE = "vyoh_oauth_state";

export type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
  domain?: string;
};

/**
 * Read a `Cookie` request header.
 *
 * Hand-rolled rather than pulling in `cookie-parser`: setting cookies is native
 * to Express, so parsing is the only half we lack, and it is this function.
 */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    // First occurrence wins, matching how browsers resolve a duplicate name:
    // a cookie set on a narrower path is sent first, and a later duplicate is
    // the one an attacker could have tossed from a sibling subdomain.
    if (name === "" || name in cookies) continue;
    const raw = pair.slice(eq + 1).trim();
    cookies[name] = decodeValue(raw);
  }
  return cookies;
}

function decodeValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    // A stray `%` is not an encoding — take the bytes as they came rather than
    // dropping a cookie the browser considers perfectly valid.
    return raw;
  }
}

export function cookieOptions(
  maxAgeMs: number,
  secure: boolean,
  domain: string | undefined
): CookieOptions {
  return {
    httpOnly: true,
    // Lax is what makes CSRF a non-issue here: the cookie rides top-level
    // navigations (so the OAuth redirect back from GitHub carries it) but not
    // cross-site POSTs, and every state-changing route is a POST.
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: maxAgeMs,
    ...(domain ? { domain } : {}),
  };
}
