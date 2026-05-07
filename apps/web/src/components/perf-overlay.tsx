import { subscribeWebVitals } from "@/lib/web-vitals";
import { useEffect, useState } from "react";
import type { Metric } from "web-vitals";

const ORDER: Metric["name"][] = ["LCP", "INP", "CLS", "FCP", "TTFB"];

const RATING_CLASS: Record<Metric["rating"], string> = {
  good: "text-emerald-400",
  "needs-improvement": "text-amber-400",
  poor: "text-red-400",
};

const formatValue = (metric: Metric) =>
  metric.name === "CLS" ? metric.value.toFixed(3) : `${Math.round(metric.value)}ms`;

const isEnabled = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("perf");

export function PerfOverlay() {
  const [enabled] = useState(isEnabled);
  const [readings, setReadings] = useState<Partial<Record<Metric["name"], Metric>>>({});

  useEffect(() => {
    if (!enabled) return;
    return subscribeWebVitals((metric) => {
      setReadings((prev) => ({ ...prev, [metric.name]: metric }));
    });
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-lg border border-border bg-background/85 px-3 py-2 font-mono text-xs shadow-lg backdrop-blur">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        web-vitals
      </div>
      <ul className="space-y-0.5">
        {ORDER.map((name) => {
          const reading = readings[name];
          return (
            <li key={name} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{name}</span>
              {reading ? (
                <span className={RATING_CLASS[reading.rating]}>
                  {formatValue(reading)}
                </span>
              ) : (
                <span className="text-muted-foreground/50">—</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
