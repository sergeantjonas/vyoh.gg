/**
 * Riot's platform routing values — the `region` half of every account identity
 * in this app.
 *
 * Shared because both ends need the same list: the api validates the `region` on
 * every account route against it, and the web's add-account form offers it as
 * that field's options. A second hand-written copy is how the two drift, and the
 * drift surfaces as a form offering a platform the api rejects.
 *
 * The type is derived from the list rather than declared beside it, so a new
 * platform can only be added in one place.
 */
export const PLATFORMS = [
  "euw1",
  "eun1",
  "tr1",
  "ru",
  "me1",
  "na1",
  "br1",
  "la1",
  "la2",
  "kr",
  "jp1",
  "oc1",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2",
] as const;

export type Platform = (typeof PLATFORMS)[number];
