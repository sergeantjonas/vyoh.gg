/**
 * Field web-vitals: what a visitor's browser beacons to `POST /rum` when the
 * page is hidden, and what the api keeps.
 *
 * A beacon carries no identifier for the visitor, and the table stores neither
 * the IP nor the user agent (nginx's access log records both, as it does for
 * every request). The web reporter sends the route *template*
 * (`/lol/$accountSlug/matches`), not the pathname, so the summary groups by
 * page kind. The api can only enforce a safe charset and length, not that the
 * string is a real template, so a reader displaying `route` must keep to the
 * routes the web's route tree knows.
 */

export const WEB_VITAL_NAMES = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const;
export type WebVitalName = (typeof WEB_VITAL_NAMES)[number];

export const WEB_VITAL_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type WebVitalRating = (typeof WEB_VITAL_RATINGS)[number];

// Mirrors web-vitals' own union, so a value the library reports always passes.
export const WEB_VITAL_NAVIGATION_TYPES = [
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
  "soft-navigation",
] as const;
export type WebVitalNavigationType = (typeof WEB_VITAL_NAVIGATION_TYPES)[number];

export const RUM_FORM_FACTORS = ["mobile", "desktop"] as const;
export type RumFormFactor = (typeof RUM_FORM_FACTORS)[number];

// One entry per metric is all a page load produces, so anything longer is not
// a browser.
export const RUM_MAX_SAMPLES = WEB_VITAL_NAMES.length;

// Samples older than this are pruned daily.
export const RUM_RETENTION_DAYS = 90;

export type WebVitalSample = {
  /**
   * web-vitals' per-page metric id (`v6-<epoch ms>-<random>`). It doubles as the
   * row key, so a CLS or INP value re-reported on a later visibility change
   * overwrites the earlier one instead of counting twice.
   */
  id: string;
  name: WebVitalName;
  value: number;
  rating: WebVitalRating;
};

export type RumBeacon = {
  route: string;
  formFactor: RumFormFactor;
  navigationType: WebVitalNavigationType;
  samples: WebVitalSample[];
};

// The read side: p75 per landing route, form factor and metric.
export const RUM_SUMMARY_WINDOW_DAYS = 7;
// Below this a percentile is one visitor's afternoon, not a measurement.
export const RUM_SUMMARY_MIN_SAMPLES = 5;

export type WebVitalP75 = {
  p75: number;
  samples: number;
  /** Share of samples web-vitals itself rated "good", 0–1. */
  goodShare: number;
};

export type WebVitalsRouteSummary = {
  route: string;
  formFactor: RumFormFactor;
  metrics: Partial<Record<WebVitalName, WebVitalP75>>;
};

export type WebVitalsSummary = {
  windowDays: number;
  minSamples: number;
  routes: WebVitalsRouteSummary[];
};
