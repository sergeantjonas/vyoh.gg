// Browser-side init script. Injected before any app code runs so the
// PerformanceObserver catches the first paint, FCP, LCP, and long-animation-
// frame entries from the very first commit. The probe reads
// `window.__perfProbe` after the scenario settles.

export const INIT_SCRIPT = `
(() => {
  const buckets = {
    paint: [],
    lcp: [],
    laf: [],
  };
  window.__perfProbe = { buckets };

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        buckets.paint.push({
          name: entry.name,
          startTime: entry.startTime,
        });
      }
    }).observe({ type: "paint", buffered: true });
  } catch (_e) {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        buckets.lcp.push({
          startTime: entry.startTime,
          renderTime: entry.renderTime ?? null,
          loadTime: entry.loadTime ?? null,
          size: entry.size ?? null,
        });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (_e) {}

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        buckets.laf.push({
          startTime: entry.startTime,
          duration: entry.duration,
          blockingDuration: entry.blockingDuration ?? null,
        });
      }
    }).observe({ type: "long-animation-frame", buffered: true });
  } catch (_e) {}
})();
`;
