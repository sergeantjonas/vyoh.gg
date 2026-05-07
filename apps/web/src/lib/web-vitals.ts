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

export function reportWebVitals(report: Reporter = consoleReporter) {
  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
}
