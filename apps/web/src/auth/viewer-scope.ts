import { keepPreviousData } from "@tanstack/react-query";

/** Which projection of a viewer-aware response a cache entry holds. */
export type ViewerScope = "owner" | "public";

/**
 * Cache-key segment for a response the api varies by viewer.
 *
 * The owner and a visitor get different bodies from the same URL, so they must
 * not share a cache entry. SSR primes the public projection — a loader runs on
 * the server, where the visitor's cookie is out of scope, as `useViewer`
 * documents — and the owner's client reads a different key and fetches its own
 * copy. No hydration mismatch, no forwarding cookies into the loader.
 *
 * Where the scope is optional it defaults to public, deliberately: a call site
 * that forgets to ask serves the owner the visitor's view, which is visible to
 * the only person who can fix it and cannot leak the other way. Same reasoning
 * as the api's `@ViewerIsOwner()` defaulting to `false`.
 *
 * The other half of a viewer-aware read is `credentials: "include"` on the
 * fetch. Without it the api sees an anonymous request and answers the public
 * projection — which then sits in the owner-scoped entry looking correct.
 */
export function viewerScope(isOwner: boolean): ViewerScope {
  return isOwner ? "owner" : "public";
}

/**
 * Shared options for a viewer-scoped read.
 *
 * `keepPreviousData` is what makes the scope flip invisible: the viewer query
 * resolves a tick after hydration, so the key changes under an already-mounted
 * component. Without it every Steam surface drops back to its skeleton for one
 * round-trip on each owner load — the data isn't gone, it's under the old key.
 */
export const viewerScopedQuery = { placeholderData: keepPreviousData } as const;
