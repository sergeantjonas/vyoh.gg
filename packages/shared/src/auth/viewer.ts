/**
 * Who is looking at the page — distinct from `Me`, which is whose *content* the
 * site is about. Every visitor gets a `Viewer`; only the owner gets `isOwner`.
 *
 * Modelled as a discriminated union rather than a nullable object so the login
 * is unreachable until `isOwner` has been checked, and `GET /auth/viewer`
 * answers 200 for anonymous visitors instead of 401 — being logged out is the
 * normal case for this endpoint, not an error the client should retry.
 */
export type Viewer = { isOwner: true; login: string } | { isOwner: false };
