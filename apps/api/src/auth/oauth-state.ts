import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Long enough for a GitHub authorize screen, short enough to be worthless later. */
export const STATE_TTL_MS = 10 * 60 * 1000;

/** Where the callback lands when `?next=` is absent or unsafe. */
export const DEFAULT_NEXT = "/status";

export type StateClaims = {
  /** Matched against a cookie of the same value, so a state token minted for someone else is useless. */
  nonce: string;
  next: string;
  exp: number;
};

export const newNonce = (): string => randomBytes(16).toString("base64url");

/**
 * Sign the OAuth `state` parameter.
 *
 * Signing rather than storing lets `next` ride along through GitHub's redirect
 * without a server-side lookup, and without letting anyone rewrite where the
 * callback sends the browser. The nonce is what defeats login-CSRF; the
 * signature is what makes the payload around it trustworthy.
 */
export function signState(claims: StateClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyState(
  token: string | undefined,
  secret: string,
  now: number
): StateClaims | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(payload, secret);
  // Length is checked first because `timingSafeEqual` throws on mismatched
  // lengths — and the length of an HMAC is not a secret worth protecting.
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const claims = decodeClaims(payload);
  if (claims === null || claims.exp <= now) return null;
  return claims;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function decodeClaims(payload: string): StateClaims | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { nonce, next, exp } = parsed as Record<string, unknown>;
  if (typeof nonce !== "string" || typeof next !== "string" || typeof exp !== "number") {
    return null;
  }
  return { nonce, next, exp };
}

/**
 * Clamp `?next=` to a path on our own site.
 *
 * A signed state token guarantees the value arrived unmodified, not that it was
 * safe when it was signed — the login route accepts `next` from whoever calls
 * it, so an attacker can craft the whole link. Without this the endpoint is an
 * open redirect that borrows our domain's credibility for a phishing landing.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next === "") return DEFAULT_NEXT;
  if (!next.startsWith("/")) return DEFAULT_NEXT;
  // `//evil.example` is protocol-relative and leaves the site; browsers
  // normalise the backslash form to the same thing.
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_NEXT;
  // A newline in a Location header is header injection.
  if (/[\r\n]/.test(next)) return DEFAULT_NEXT;
  return next;
}
