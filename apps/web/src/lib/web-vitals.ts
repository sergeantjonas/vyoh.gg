import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

type Reporter = (metric: Metric) => void;

const ratingColor: Record<Metric["rating"], string> = {
  good: "color: #34d399",
  "needs-improvement": "color: #fbbf24",
  poor: "color: #f87171",
};

const consoleReporter: Reporter = (metric) => {
  const value =
    metric.name === "CLS" ? metric.value.toFixed(3) : `${Math.round(metric.value)}ms`;
  console.info(
    `%c[web-vitals] ${metric.name}%c ${value} (${metric.rating})`,
    `${ratingColor[metric.rating]}; font-weight: 600`,
    "color: inherit"
  );
};

const subscribers = new Set<Reporter>();
const latest = new Map<Metric["name"], Metric>();
let started = false;

const broadcast: Reporter = (metric) => {
  latest.set(metric.name, metric);
  for (const reporter of subscribers) reporter(metric);
};

function start() {
  if (started) return;
  started = true;
  const opts = { reportAllChanges: true };
  onCLS(broadcast, opts);
  onFCP(broadcast);
  onINP(broadcast, opts);
  onLCP(broadcast, opts);
  onTTFB(broadcast);
}

export function subscribeWebVitals(reporter: Reporter): () => void {
  start();
  subscribers.add(reporter);
  for (const metric of latest.values()) reporter(metric);
  return () => {
    subscribers.delete(reporter);
  };
}

export function reportWebVitals(reporter: Reporter = consoleReporter) {
  subscribeWebVitals(reporter);
}
