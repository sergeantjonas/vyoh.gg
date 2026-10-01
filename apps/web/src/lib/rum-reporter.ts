import { API_URL } from "@/lib/api-url";
import { subscribeWebVitals } from "@/lib/web-vitals";
import {
  RUM_MAX_SAMPLES,
  type RumBeacon,
  type WebVitalNavigationType,
  type WebVitalSample,
} from "@vyoh/shared";

/**
 * Beacons field web-vitals to `POST /rum` each time the page is hidden.
 *
 * Every sample is attributed to the route the visitor landed on. LCP, FCP and
 * TTFB only exist for that document load, and INP and CLS accumulate across the
 * soft navigations after it, so the landing page is the only attribution the
 * numbers support.
 *
 * Only a value that changed since the last beacon is sent again; the api keys
 * rows on the metric id, so a re-sent CLS or INP replaces its earlier reading.
 */
export function startRumReporter(route: string): () => void {
  // Headless browsers are this site's own probes, not visitors.
  if (navigator.webdriver || typeof navigator.sendBeacon !== "function") return () => {};

  const formFactor = window.matchMedia("(width < 48rem)").matches ? "mobile" : "desktop";
  const latest = new Map<
    string,
    { sample: WebVitalSample; navigationType: WebVitalNavigationType }
  >();
  const sent = new Map<string, number>();

  const unsubscribe = subscribeWebVitals((metric) => {
    const { id, name, value, rating, navigationType } = metric;
    latest.set(id, { sample: { id, name, value, rating }, navigationType });
  });

  const flush = () => {
    // A bfcache restore starts new metrics under a different navigation type,
    // and the type is a property of the beacon, so each type is its own batch.
    const batches = new Map<WebVitalNavigationType, WebVitalSample[]>();
    for (const { sample, navigationType } of latest.values()) {
      if (sent.get(sample.id) === sample.value) continue;
      const batch = batches.get(navigationType) ?? [];
      batch.push(sample);
      batches.set(navigationType, batch);
    }
    for (const [navigationType, samples] of batches) {
      for (let i = 0; i < samples.length; i += RUM_MAX_SAMPLES) {
        const chunk = samples.slice(i, i + RUM_MAX_SAMPLES);
        const beacon: RumBeacon = { route, formFactor, navigationType, samples: chunk };
        // A string body goes as `text/plain`, the one type a cross-origin
        // beacon can carry without a preflight.
        if (!navigator.sendBeacon(`${API_URL}/rum`, JSON.stringify(beacon))) continue;
        for (const s of chunk) sent.set(s.id, s.value);
      }
    }
  };

  // On `document` without capture, so it runs at the target phase, after
  // web-vitals' own capturing `window` listeners have reported their final
  // values for this hide, whatever order the two were registered in.
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", flush);

  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", flush);
  };
}
