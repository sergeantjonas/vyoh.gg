// Server-side mirror of the owner's curation overlay. Kept here (not in a
// shared package) because the landing-config the web layer reads also stays
// out of the shared barrel — these are owner-edited toggles for `/`, not
// domain types. When the web-side `landing-config.ts` HIDDEN_APPIDS list
// changes, mirror the change here so the selector's per-kind cap doesn't
// get padded by a chapter the frontend immediately throws away.
//
// Source of truth on the web side:
//   apps/web/src/home/landing-config.ts
//
// Promotes to a shared `@vyoh/shared` curation file once a second consumer
// needs it (e.g. an admin UI). Not before.

/** Steam appids never surfaced as a subject chapter on `/`, even if the
 *  recency-decayed score qualifies. Mirror manually with the web list. */
export const RECAP_HIDDEN_APPIDS: ReadonlySet<number> = new Set([
  1034140, // matches apps/web/src/home/landing-config.ts
  1091500, // Cyberpunk 2077 — owner-curated hide from `/`
]);
